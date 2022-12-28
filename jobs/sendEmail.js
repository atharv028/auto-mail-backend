require("dotenv").config();
const { workerData } = require("worker_threads");
const nodeMailer = require("nodemailer");

async function main() {
  console.log(workerData.description);

  //Transporter configuration
  let transporter = nodeMailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL, //REPLACE WITH YOUR EMAIL ADDRESS
      pass: process.env.PASSWORD, //REPLACE WITH YOUR EMAIL PASSWORD
    },
  });

  //Email configuration
  await transporter.sendMail({
    from: "atharv.tare.3@gmail.com", //SENDER
    bcc: "atharv.tare.3@gmail.com, atharv.tare.03@gmail.com, sokata143@gmail.com, gajendrashah04021@gmail.com", //MULTIPLE RECEIVERS
    subject: "Proposal", //EMAIL SUBJECT
    // text: "This is a test email.", //EMAIL BODY IN TEXT FORMAT
    html: `Hello,
    <br />
    <br />
    I'm Bhartesh Bhaskar, director at Forethought an edtech, where we connect
    students with the world's best professors from instituitions like
    <b>Harvard</b>, <b>Stanford</b>, <b>MIT</b>, etc. for the first hand
    learning and work experience.
    <br />
    <br />
    We would love to collaborate with your instituition to help your students
    not only learn throught our unique courses but also uplift their CV/Resume
    with a Letter of Recommendation from world's eminent professors in the form
    of Live Courses for better exposure as well as more internship & job
    opputunities.
    <br />
    <br />
    Would you like to know more about this opportunity?
    <br />
    <br />
    Best,
    <br />
    Bhartesh`, //EMAIL BODY IN HTML FORMAT
  });
}

main().catch((err) => console.log(err));
