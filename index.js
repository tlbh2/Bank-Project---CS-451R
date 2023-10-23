import express from "express";

const app = express();
const port = 3000;

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.get("/index", (req, res) => {
  res.render("index.ejs");
});


app.get("/contact", (req, res) => {
  res.render("contact.ejs");
});

app.get("/plaidChartView", (req, res) => {
  res.render("plaidChartView.ejs");
});

app.get("/about", (req, res) => {
  res.render("about.ejs");
});

app.get("/logInSignUp", (req, res) => {
  res.render("logInSignUp.ejs");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});


