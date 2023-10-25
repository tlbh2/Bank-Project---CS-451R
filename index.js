//Using Passport.js to Add Cookies and Sessions
const dotenv = require('dotenv')
dotenv.config()

const express = require('express')
const bodyParser = require('body-parser')
const ejs = require('ejs')
const mongoose = require('mongoose')
const session = require('express-session')
const passport = require('passport')
const passportLocalMongoose = require('passport-local-mongoose')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const findOrCreate = require('mongoose-findorcreate')

const app = express()
const port = 3000

app.use(express.static('public'))

app.get('/', (req, res) => {
  res.render('index.ejs')
})

app.get('/index', (req, res) => {
  res.render('index.ejs')
})

app.get('/contact', (req, res) => {
  res.render('contact.ejs')
})

app.get('/plaidChartView', (req, res) => {
  res.render('plaidChartView.ejs')
})

app.get('/about', (req, res) => {
  res.render('about.ejs')
})

app.get('/logInSignUp', (req, res) => {
  res.render('logInSignUp.ejs')
})

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
