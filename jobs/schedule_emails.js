const { workerData, parentPort } = require("worker_threads");
const nodeMailer = require("nodemailer");

const CyclicDb = require("@cyclic.sh/dynamodb");
const db = CyclicDb("bored-dog-wrapCyclicDB");

const storage = db.collection("emails");

async function main() {
  const mailList = workerData.emailList;
  const senderId = workerData.senderId;
  const toEmails = workerData.toEmails;
  const body = workerData.bodyHtml;
  const subject = workerData.subject;
  const senderMail = workerData.senderMail;
  const senderPass = workerData.senderPass;
  const jobId = workerData.jobId;

  let transporter = nodeMailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: senderMail,
      pass: senderPass,
    },
  });
  const obj = await storage.get(senderMail);
  console.log(obj);
  if (obj === null || obj.props.currIndex === null) {
    if (mailList.length > 90) {
      const currList = mailList.slice(0, 90);
      await sendMail({
        transporter: transporter,
        emails: currList,
        text: body,
        toEmails: toEmails,
        subject: subject,
      });
      await storage.set(senderMail, {
        currIndex: "90",
        completedList: currList,
        totalList: mailList,
        jobId: jobId,
      });
    } else {
      await sendMail({
        transporter: transporter,
        emails: mailList,
        text: body,
        toEmails: toEmails,
        subject: subject,
      });
      await storage.delete(senderMail);
    }
  } else {
    if (parseInt(obj.props.currIndex) == mailList.length) {
      await storage.set(senderMail, {});
      parentPort.postMessage("stop");
    } else {
      const currList = mailList.slice(
        parseInt(obj.props.currIndex),
        parseInt(obj.props.currIndex) + 90
      );
      await sendMail({
        transporter: transporter,
        emails: currList,
        text: body,
        toEmails: toEmails,
        subject: subject,
      });
      const count = parseInt(obj.props.currIndex) + parseInt(currList.length);
      if (count == mailList.length) {
        await storage.delete(senderMail);
        parentPort.postMessage("stop");
      } else {
        await storage.set(senderMail, {
          currIndex: count,
          completedList: [...obj.props.completedList, ...currList],
          totalList: mailList,
          jobId: jobId,
        });
      }
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
