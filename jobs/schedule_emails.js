const { workerData, parentPort } = require("worker_threads");
const nodeMailer = require("nodemailer");

// const CyclicDb = require("@cyclic.sh/dynamodb");
// const db = CyclicDb("bored-dog-wrapCyclicDB");

// const storage = db.collection("emails");

const storage = require("node-persist");

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri =
  "mongodb+srv://atharv_tare:TcRKC70mKHZ9d0ZX@clusterautomails.2au0kx5.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function main() {
  const mailList = workerData.emailList;
  const senderId = workerData.senderId;
  const toEmails = workerData.toEmails;
  const body = workerData.bodyHtml;
  const subject = workerData.subject;
  const senderMail = workerData.senderMail;
  const senderPass = workerData.senderPass;
  const jobId = workerData.jobId;

  await client.connect();
  // await storage.init();

  let transporter = nodeMailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: senderMail,
      pass: senderPass,
    },
  });
  const obj = await client.db("emails").collection(senderMail).findOne({});
  // const obj = db.getSync(senderMail);
  console.log(obj);
  if (obj === null || obj.currIndex === null) {
    if (mailList.length > 90) {
      const currList = mailList.slice(0, 90);
      await sendMail({
        transporter: transporter,
        emails: currList,
        text: body,
        toEmails: toEmails,
        subject: subject,
      });
      await client.db("emails").collection(senderMail).insertOne({
        currIndex: "90",
        completedList: currList,
        totalList: mailList,
        jobId: jobId,
      });
      await client
        .db("emails")
        .collection(senderMail)
        .deleteOne({ _id: obj._id });
      // await storage.setItem(senderMail, {
      //   currIndex: "90",
      //   completedList: currList,
      //   totalList: mailList,
      //   jobId: jobId,
      // });
    } else {
      await sendMail({
        transporter: transporter,
        emails: mailList,
        text: body,
        toEmails: toEmails,
        subject: subject,
      });
      await client.db("emails").collection(senderMail).drop();
      // await storage.setItem(senderMail, {});
      // db.saveSync(senderMail, {});
    }
  } else {
    if (parseInt(obj.currIndex) == mailList.length) {
      await client.db("emails").collection(senderMail).drop();
      // await storage.setItem(senderMail, {});
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
        await client.db("emails").collection(senderMail).drop();
        // await storage.setItem(senderMail, {});
        parentPort.postMessage("stop");
      } else {
        await client
          .db("emails")
          .collection(senderMail)
          .insertOne({
            currIndex: count,
            completedList: [...obj.completedList, ...currList],
            totalList: mailList,
            jobId: jobId,
          });
        await client
          .db("emails")
          .collection(senderMail)
          .deleteOne({ _id: obj._id });
        // await storage.setItem(senderMail, {
        //   currIndex: count,
        //   completedList: [...obj.completedList, ...currList],
        //   totalList: mailList,
        //   jobId: jobId,
        // });
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
