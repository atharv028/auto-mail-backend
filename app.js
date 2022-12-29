const express = require("express");
const app = express();

const path = require("path");

const Bree = require("bree");

const bodyparser = require("body-parser");

const appDir = path.resolve(__dirname);

const file_path = path.join(appDir + "/jobs", "schedule_emails.js");

const port = process.env.PORT || 4000;

const CyclicDb = require("@cyclic.sh/dynamodb");
const db = CyclicDb("bored-dog-wrapCyclicDB");

const storage = db.collection("emails");

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
  await bree.add({
    name: jobId,
    path: file_path,
    interval: `every ${timeStart}`,
    worker: {
      workerData: {
        bodyHtml: bodyHtml,
        subject: subject,
        emailList: emails,
        toEmails: toEmails,
        senderId: uid,
        senderMail: senderMail,
        senderPass: senderPass,
        jobId: jobId,
      },
    },
  });
  await storage.set(senderMail, {
    jobId: jobId,
    currIndex: 0,
    completedList: [],
    totalList: emails,
  });
  await bree.start(jobId);
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
    // (async () => {
    //   await bree.add({
    //     name: jobId,
    //     path: file_path,
    //     interval: `every ${timeStart}`,
    //     worker: {
    //       workerData: {
    //         bodyHtml: bodyHtml,
    //         subject: subject,
    //         emailList: emails,
    //         toEmails: toEmails,
    //         senderId: uid,
    //         senderMail: senderMail,
    //         senderPass: senderPass,
    //         jobId: jobId,
    //       },
    //     },
    //   });
    // })().then(async () => {
    //   await storage.set(senderMail, {
    //     jobId: jobId,
    //     currIndex: 0,
    //     completedList: [],
    //     totalList: emails,
    //   });
    //   await bree.start(jobId);
    // });
    res.send({ status: 200, message: "Scheduled Successfully", jobId: jobId });
  } catch ({ err }) {
    res.send({ status: 400, message: "Error Occured" });
  }
});

app.get("/getJobs", async (req, res) => {
  const uid = req.query.senderMail;
  const jobs = await storage.get(uid);
  console.log(jobs);
  if (jobs === null || jobs.props.currIndex === null) {
    res.send({
      status: 200,
      jobsList: [],
      message: `No Jobs Scheduled for the mail ${uid}`,
    });
  } else {
    try {
      const remainingCount =
        parseInt(jobs.props.totalList.length) -
        parseInt(jobs.props.completedList.length);
      res.send({
        status: 200,
        jobId: jobs.props.jobId,
        completedMails: jobs.props.completedList,
        totalList: jobs.props.totalList,
        message: `${remainingCount}/${parseInt(
          jobs.props.totalList.length
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
    await bree.stop(jobId);
    await storage.delete(senderMail);
    res.send({ status: 200, message: "Cancelled Successfully" });
  } else {
    res.send({ status: 400, message: "error occured" });
  }
});

(async () => {
  await bree.start();
  // await storage.init();
})();
