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
app.set('view engine', 'ejs')
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
)

//initialize session
app.use(
  session({
    secret: 'Our little secret.',
    resave: false,
    saveUninitialized: false,
  })
)

app.use(passport.initialize())
app.use(passport.session())

//connect to local database by mongodb
mongoose.connect('mongodb://127.0.0.1:27017/bankUserDB')
//mongoose.connect("mongodb+srv://tinlao:laotrungtin@cluster0.oxpatx9.mongodb.net/todolistDB");

//an object that created from Schema class of mongodb
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
})

userSchema.plugin(passportLocalMongoose)
userSchema.plugin(findOrCreate)

const User = new mongoose.model('User', userSchema)

passport.use(User.createStrategy())

//serialize and deserialize of model for passport session
passport.serializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, {
      id: user.id,
      username: user.username,
      picture: user.picture,
    })
  })
})

passport.deserializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, user)
  })
})

//put this before the route and after initialize session and serialize and deserialize
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: 'http://localhost:3000/auth/google/home', //redirect user to this URL once access is granted (or denied)
    },
    function (accessToken, refreshToken, profile, cb) {
      console.log(profile)

      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user)
      })
    }
  )
)

app.get('/', (req, res) => {
  res.render('home.ejs')
})

app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }))

//make sure the link match Authorized redicet URLs on google APIs account
app.get(
  '/auth/google/secrets',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function (req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect('/secrets')
  }
)

app.get('/submit', function (req, res) {
  if (req.isAuthenticated()) {
    res.render('submit')
  } else {
    res.redirect('/login')
  }
})

app.post('/submit', async function (req, res) {
  const submittedSecret = req.body.secret
  try {
    const foundUser = await User.findById(req.user.id)
    if (foundUser) {
      foundUser.secret = submittedSecret
      await foundUser.save()
      res.redirect('/secrets')
    }
  } catch (err) {
    console.log(err)
  }
})

app.post('/logout', function (req, res, next) {
  req.logout(function (err) {
    if (err) {
      return next(err)
    }
    res.redirect('/')
  })
})

app.post('/register', function (req, res) {
  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (err) {
        console.log(err)
        res.redirect('/register')
      } else {
        passport.authenticate('local')(req, res, function () {
          res.redirect('/index')
        })
      }
    }
  )
})

app.post('/login', function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  })

  req.login(user, function (err) {
    if (err) {
      console.log(err)
    } else {
      passport.authenticate('local')(req, res, function () {
        res.redirect('/index')
      })
    }
  })
})

app.get('/index', (req, res) => {
  res.render('home.ejs')
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
