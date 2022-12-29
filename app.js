const express = require("express");
const app = express();
const Cabin = require("cabin");
const path = require("path");
const Bree = require("bree");
const bodyparser = require("body-parser");
const appDir = path.resolve(__dirname);
const file_path = path.join(appDir + "/jobs", "schedule_emails.js");
// var Store = require("jfs");
// var db = new Store(__dirname + "/config.json", { pretty: true });

// const storage = require("node-persist");

const CyclicDb = require("@cyclic.sh/dynamodb");
const db = CyclicDb("bored-dog-wrapCyclicDB");

const storage = db.collection("emails");

const handler = (msg) => {
  let threadId = bree.getWorkerMetadata(msg.name).worker.threadId;
  console.log(`Iteration: ${msg.message} thread ${threadId}`);
  if (msg.message === "stop") {
    bree.stop(msg.name);
  }
};

const bree = new Bree({
  logger: new Cabin(),
  root: false,
  jobs: [],
  errorHandler: (error, workerMetaData) => {
    console.log(error);
  },
  workerMessageHandler: handler,
  outputWorkerMetadata: true,
});

var jobNum = 0;

app.use(bodyparser.urlencoded({ extended: false }));
app.use(bodyparser.json());

app.listen(4000, () => console.log("Listening to port 4000"));

app.get("/", (req, res) => {
  bree.start();
  res.send("Started");
});

app.post("/scheduleEmail", (req, res) => {
  const senderMail = req.body.senderMail;
  const senderPass = req.body.senderPass;
  const bodyHtml = req.body.body;
  const subject = req.body.subject;
  console.log(req.body.emails);
  const toEmails = req.body.toEmails;
  const emails = req.body.emails;
  const timeStart = req.body.startTime;
  const uid = req.body.uid;

  // const jobsToID = [];
  // const firstJob = true;

  // try {
  //   const jobs = db.getSync(senderMail);
  //   console.log(isNaN(jobs.count));
  //   if (isNaN(jobs.count) == false) {
  //     jobsToID = [...jobs.jobs];
  //     firstJob = false;
  //   }
  // } catch ({ err }) {
  //   console.log(err);
  // }

  console.log(`${senderPass} ${emails} ${timeStart} ${uid}`);

  try {
    const jobId = `mailer-${jobNum++}`;
    (async () => {
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
    })().then(async () => {
      await storage.set(senderMail, {
        jobId: jobId,
        currIndex: 0,
        completedList: [],
        totalList: emails,
      });
      // console.log("job to ID :" + jobsToID);
      // if (firstJob === true) {
      //   db.saveSync(senderMail, { jobs: [jobId], count: 1 });
      // } else {
      //   db.saveSync(senderMail, {
      //     jobs: [...jobsToID, jobId],
      //     count: ++jobsToID.length,
      //   });
      // }
      await bree.start(jobId);
    });
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
