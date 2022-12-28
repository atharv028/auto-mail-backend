const { workerData, parentPort } = require("worker_threads");
const nodeMailer = require("nodemailer");
var Store = require("jfs");
var db = new Store(__dirname + "/config.json", { pretty: true });

const storage = require("node-persist");

async function main() {
  const mailList = workerData.emailList;
  const senderId = workerData.senderId;
  const toEmails = workerData.toEmails;
  const body = workerData.bodyHtml;
  const subject = workerData.subject;
  const senderMail = workerData.senderMail;
  const senderPass = workerData.senderPass;
  const jobId = workerData.jobId;

  await storage.init();

  let transporter = nodeMailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: senderMail,
      pass: senderPass,
    },
  });
  const obj = await storage.getItem(senderMail);
  // const obj = db.getSync(senderMail);
  console.log(obj);
  if (obj === undefined || obj.currIndex === undefined) {
    if (mailList.length > 90) {
      const currList = mailList.slice(0, 90);
      await sendMail({
        transporter: transporter,
        emails: currList,
        text: body,
        toEmails: toEmails,
        subject: subject,
      });
      await storage.setItem(senderMail, {
        currIndex: "90",
        completedList: currList,
        totalList: mailList,
        jobId: jobId,
      });
      // db.saveSync(senderMail, {
      //   currIndex: "90",
      //   completedList: currList,
      //   totalList: mailList,
      // });
    } else {
      await sendMail({
        transporter: transporter,
        emails: mailList,
        text: body,
        toEmails: toEmails,
        subject: subject,
      });
      await storage.setItem(senderMail, {});
      // db.saveSync(senderMail, {});
    }
  } else {
    if (parseInt(obj.currIndex) == mailList.length) {
      await storage.setItem(senderMail, {});
      // await db.save(senderMail, {});
      parentPort.postMessage("stop");
    } else {
      const currList = mailList.slice(
        parseInt(obj.currIndex),
        parseInt(obj.currIndex) + 90
      );
      await sendMail({
        transporter: transporter,
        emails: currList,
        text: body,
        toEmails: toEmails,
        subject: subject,
      });
      const count = parseInt(obj.currIndex) + parseInt(currList.length);
      if (count == mailList.length) {
        await storage.setItem(senderMail, {});
        parentPort.postMessage("stop");
      } else {
        await storage.setItem(senderMail, {
          currIndex: count,
          completedList: [...obj.completedList, ...currList],
          totalList: mailList,
          jobId: jobId,
        });
      }
      // db.saveSync(senderMail, {
      //   currIndex: `${parseInt(obj.currIndex) + parseInt(currList.length)}`,
      //   completedList: [...obj.completedList, ...currList],
      //   totalList: mailList,
      // });
    }
  }
  process.exit(0);
}

async function sendMail({ transporter, emails, text, subject, toEmails }) {
  await transporter.sendMail({
    from: "Forethought India",
    to: toEmails,
    bcc: emails,
    subject: subject,
    html: text,
  });
}

main().catch((err) => console.log(err));
