const express = require("express");
const app = express();

const path = require("path");

const Bree = require("bree");
const Agenda = require("agenda");
const { Job, JobAttributesData } = require("agenda");

const bodyparser = require("body-parser");

const appDir = path.resolve(__dirname);

const file_path = path.join(appDir + "/jobs", "schedule_emails.js");
// const storage = require("node-persist");

const port = process.env.PORT || 65535;

// const CyclicDb = require("@cyclic.sh/dynamodb");
// const db = CyclicDb("bored-dog-wrapCyclicDB");

// const storage = db.collection("emails");

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri =
  "mongodb+srv://atharv_tare:TcRKC70mKHZ9d0ZX@clusterautomails.2au0kx5.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const agenda = new Agenda({ db: { address: uri, collection: "agendaJobs" } });

const handler = (msg) => {
  if (msg.message === "stop") {
    bree.stop(msg.name);
  }
};

const bree = new Bree({
  root: false,
  jobs: [],
  workerMessageHandler: handler,
});

const main = require("./jobs/schedule_emails.js");
// import main from "./jobs/schedule_emails.js";

var jobNum = 0;

app.use(bodyparser.urlencoded({ extended: false }));
app.use(bodyparser.json());

app.listen(port, () => console.log(`Listening to port ${port}`));

app.get("/", async (req, res) => {
  await bree.start();
  res.send("Started");
});

const scheduleMailFun = async ({
  jobId,
  timeStart,
  bodyHtml,
  subject,
  emails,
  toEmails,
  uid,
  senderMail,
  senderPass,
}) => {
  agenda.define(jobId, async (job) => {
    await main({
      mailList: emails,
      toEmails: toEmails,
      body: bodyHtml,
      subject: subject,
      senderMail: senderMail,
      senderPass: senderPass,
      jobId: jobId,
    }).catch((err) => console.log(err));
  });
  // await bree.add({
  //   name: jobId,
  //   path: file_path,
  //   interval: `at ${timeStart}`,
  //   worker: {
  //     workerData: {
  //       bodyHtml: bodyHtml,
  //       subject: subject,
  //       emailList: emails,
  //       toEmails: toEmails,
  //       senderId: uid,
  //       senderMail: senderMail,
  //       senderPass: senderPass,
  //       jobId: jobId,
  //     },
  //   },
  // });
  // await storage.setItem(senderMail, {
  // jobId: jobId,
  // currIndex: 0,
  // completedList: [],
  // totalList: emails,
  // });

  await client.db("emails").collection(senderMail).insertOne({
    jobId: jobId,
    currIndex: 0,
    completedList: [],
    totalList: emails,
  });
  await agenda.schedule(`everyday at ${timeStart}`, jobId);
  // await bree.start(jobId);
};

app.post("/scheduleEmail", async (req, res) => {
  const senderMail = req.body.senderMail;
  const senderPass = req.body.senderPass;
  const bodyHtml = req.body.body;
  const subject = req.body.subject;
  const toEmails = req.body.toEmails;
  const emails = req.body.emails;
  const timeStart = req.body.startTime;
  const uid = req.body.uid;

  try {
    console.log(`${senderMail} ${senderPass} ${emails.length}`);
    const jobId = `mailer-${jobNum++}`;

    await scheduleMailFun({
      jobId: jobId,
      timeStart: timeStart,
      bodyHtml: bodyHtml,
      subject: subject,
      emails: emails,
      toEmails: toEmails,
      uid: uid,
      senderMail: senderMail,
      senderPass: senderPass,
    });
    res.send({ status: 200, message: "Scheduled Successfully", jobId: jobId });
  } catch ({ err }) {
    res.send({ status: 400, message: "Error Occured" });
  }
});

app.get("/getJobs", async (req, res) => {
  const uid = req.query.senderMail;
  const jobs = await client.db("emails").collection(uid).findOne();
  console.log(jobs);
  if (jobs === null || jobs.currIndex === null) {
    res.send({
      status: 200,
      jobsList: [],
      message: `No Jobs Scheduled for the mail ${uid}`,
    });
  } else {
    try {
      const remainingCount =
        parseInt(jobs.totalList.length) - parseInt(jobs.completedList.length);
      res.send({
        status: 200,
        jobId: jobs.jobId,
        completedMails: jobs.completedList,
        totalList: jobs.totalList,
        message: `${remainingCount}/${parseInt(
          jobs.totalList.length
        )} remaining for ${uid}`,
      });
    } catch (error) {
      console.log(error);
    }
  }
});

app.get("/cancelJob", async (req, res) => {
  const jobId = req.query.jobId;
  const senderMail = req.query.senderMail;
  console.log(jobId);
  if (jobId != undefined) {
    await agenda.cancel({ name: jobId });
    // await bree.stop(jobId);
    await client.db("emails").collection(senderMail).drop();
    // await storage.setItem(senderMail, {});
    res.send({ status: 200, message: "Cancelled Successfully" });
  } else {
    res.send({ status: 400, message: "error occured" });
  }
});

(async () => {
  // await bree.start();
  await client.connect();
  await agenda.start();
  // await storage.init();
})();
