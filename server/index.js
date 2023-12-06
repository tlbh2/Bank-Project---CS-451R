//Using Passport.js to Add Cookies and Sessions
const dotenv = require('dotenv')
dotenv.config()

const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require("cookie-parser");
const ejs = require('ejs')
const mongoose = require('mongoose')
const session = require('express-session')
const passport = require('passport')
const passportLocalMongoose = require('passport-local-mongoose')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const findOrCreate = require('mongoose-findorcreate')

const app = express()
const port = 3000

// Set the view engine to ejs
app.set('view engine', 'ejs');

const path = require('path');
app.set('views', path.join(__dirname, '../views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(cookieParser());
app.use(bodyParser.json());

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
)

const usersRouter = require("./routes/users");
const linkTokenRouter = require("./routes/tokens");
const bankRouter = require("./routes/banks");
const { router: transactionsRouter } = require("./routes/transactions");
const debugRouter = require("./routes/debug");
const { getWebhookServer } = require("./webhookServer");

app.use("/server/users", usersRouter);
app.use("/server/tokens", linkTokenRouter);
app.use("/server/banks", bankRouter);
app.use("/server/transactions", transactionsRouter);
app.use("/server/debug", debugRouter);

/* Add in some basic error handling so our server doesn't crash if we run into
 * an error.
 */
const errorHandler = function (err, req, res, next) {
  console.error(`Your error:`);
  console.error(err);
  if (err.response?.data != null) {
    res.status(500).send(err.response.data);
  } else {
    res.status(500).send({
      error_code: "OTHER_ERROR",
      error_message: "I got some other message on the server.",
    });
  }
};
app.use(errorHandler);

// Initialize our webhook server, too.
const webhookServer = getWebhookServer();

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
  profilePic: String,
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
      callbackURL: 'http://localhost:3000/auth/google/index', //redirect user to this URL once access is granted (or denied), need to be the same as the one on Google APIs Console
    },
    function (accessToken, refreshToken, profile, cb) {
      console.log(profile)

      //capture profile id 
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user)
      })
    }
  )
)


app.get('/', (req, res) => {
  res.render('home.ejs', { req: req });
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }))

//make sure the link match Authorized redicet URLs on google APIs account
app.get(
  '/auth/google/index',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function (req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect('/index')
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
  res.render('home.ejs', { req: req });
});

app.get('/contact', (req, res) => {
  res.render('contact.ejs', { req: req });
})

app.get('/plaidChartView', (req, res) => {
  res.render('plaidChartView.ejs', { req: req });
});

app.get('/about', (req, res) => {
  res.render('about.ejs', { req: req });
});

app.get('/logIn', (req, res) => {
  res.render('logIn.ejs', { req: req });
});

app.get('/signUp', (req, res) => {
  res.render('signUp.ejs', { req: req });
});

app.get('/profile', (req, res) => {
  res.render('profile.ejs', { req: req });
});

app.get('/link', (req, res) => {
  res.render('link.ejs', { req: req });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
