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

//-----Plaid-start------------------------------------------//
const plaid = require('plaid');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const util = require('util');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const cors = require('cors');

const APP_PORT = port;
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';

const PLAID_PRODUCTS = (process.env.PLAID_PRODUCTS || Products.Transactions).split(
  ',',
);

const PLAID_COUNTRY_CODES = (process.env.PLAID_COUNTRY_CODES || 'US').split(
  ',',
);

let ACCESS_TOKEN = null;
let PUBLIC_TOKEN = null;
let ITEM_ID = null;
let ACCOUNT_ID = null;
let PAYMENT_ID = null;
let AUTHORIZATION_ID = null;
let TRANSFER_ID = null;

// Initialize the Plaid client
// Find the API keys in the Dashboard (https://dashboard.plaid.com/account/keys)
const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
      'PLAID-SECRET': PLAID_SECRET,
      'Plaid-Version': '2020-09-14',
    },
  },
});

const client = new PlaidApi(configuration);

app.use(
  bodyParser.urlencoded({
    extended: false,
  }),
);
app.use(bodyParser.json());
app.use(cors());

app.post('/api/info', function (request, response, next) {
  response.json({
    item_id: ITEM_ID,
    access_token: ACCESS_TOKEN,
    products: PLAID_PRODUCTS,
  });
});

// Create a link token with configs which we can then use to initialize Plaid Link client-side.
app.post('/api/create_link_token', function (request, response, next) {
  Promise.resolve()
    .then(async function () {
      const configs = {
        user: {
          // This should correspond to a unique id for the current user.
          client_user_id: 'user-id',
        },
        client_name: 'Plaid Quickstart',
        products: PLAID_PRODUCTS,
        country_codes: PLAID_COUNTRY_CODES,
        language: 'en',
      };

      if (PLAID_REDIRECT_URI !== '') {
        configs.redirect_uri = PLAID_REDIRECT_URI;
      }

      if (PLAID_ANDROID_PACKAGE_NAME !== '') {
        configs.android_package_name = PLAID_ANDROID_PACKAGE_NAME;
      }
      const createTokenResponse = await client.linkTokenCreate(configs);
      prettyPrintResponse(createTokenResponse);
      response.json(createTokenResponse.data);
    })
    .catch(next);
});

// Create a link token with configs which we can then use to initialize Plaid Link client-side
// for a 'payment-initiation' flow.
app.post(
  '/api/create_link_token_for_payment',
  function (request, response, next) {
    Promise.resolve()
      .then(async function () {
        const createRecipientResponse =
          await client.paymentInitiationRecipientCreate({
            name: 'Harry Potter',
            iban: 'GB33BUKB20201555555555',
            address: {
              street: ['4 Privet Drive'],
              city: 'Little Whinging',
              postal_code: '11111',
              country: 'GB',
            },
          });
        const recipientId = createRecipientResponse.data.recipient_id;
        prettyPrintResponse(createRecipientResponse);

        const createPaymentResponse =
          await client.paymentInitiationPaymentCreate({
            recipient_id: recipientId,
            reference: 'paymentRef',
            amount: {
              value: 1.23,
              currency: 'GBP',
            },
          });
        prettyPrintResponse(createPaymentResponse);
        const paymentId = createPaymentResponse.data.payment_id;

        // We store the payment_id in memory for demo purposes - in production, store it in a secure
        // persistent data store along with the Payment metadata, such as userId.
        PAYMENT_ID = paymentId;

        const configs = {
          client_name: 'Plaid Quickstart',
          user: {
            // This should correspond to a unique id for the current user.
            // Typically, this will be a user ID number from your application.
            // Personally identifiable information, such as an email address or phone number, should not be used here.
            client_user_id: uuidv4(),
          },
          // Institutions from all listed countries will be shown.
          country_codes: PLAID_COUNTRY_CODES,
          language: 'en',
          // The 'payment_initiation' product has to be the only element in the 'products' list.
          products: [Products.PaymentInitiation],
          payment_initiation: {
            payment_id: paymentId,
          },
        };
        if (PLAID_REDIRECT_URI !== '') {
          configs.redirect_uri = PLAID_REDIRECT_URI;
        }
        const createTokenResponse = await client.linkTokenCreate(configs);
        prettyPrintResponse(createTokenResponse);
        response.json(createTokenResponse.data);
      })
      .catch(next);
  },
);

// Exchange token flow - exchange a Link public_token for an API access_token
app.post('/api/set_access_token', function (request, response, next) {
  PUBLIC_TOKEN = request.body.public_token;
  Promise.resolve()
    .then(async function () {
      const tokenResponse = await client.itemPublicTokenExchange({
        public_token: PUBLIC_TOKEN,
      });
      prettyPrintResponse(tokenResponse);
      ACCESS_TOKEN = tokenResponse.data.access_token;
      ITEM_ID = tokenResponse.data.item_id;
      response.json({
        // the 'access_token' is a private token, DO NOT pass this token to the frontend in your production environment
        access_token: ACCESS_TOKEN,
        item_id: ITEM_ID,
        error: null,
      });
    })
    .catch(next);
});
// Retrieve ACH or ETF Auth data for an Item's accounts
app.get('/api/auth', function (request, response, next) {
  Promise.resolve()
    .then(async function () {
      const authResponse = await client.authGet({
        access_token: ACCESS_TOKEN,
      });
      prettyPrintResponse(authResponse);
      response.json(authResponse.data);
    })
    .catch(next);
});

// Retrieve Transactions for an Item
app.get('/api/transactions', function (request, response, next) {
  Promise.resolve()
    .then(async function () {
      // Set cursor to empty to receive all historical updates
      let cursor = null;

      // New transaction updates since "cursor"
      let added = [];
      let modified = [];
      // Removed transaction ids
      let removed = [];
      let hasMore = true;
      // Iterate through each page of new transaction updates for item
      while (hasMore) {
        const request = {
          access_token: ACCESS_TOKEN,
          cursor: cursor,
        };
        const response = await client.transactionsSync(request)
        const data = response.data;
        // Add this page of results
        added = added.concat(data.added);
        modified = modified.concat(data.modified);
        removed = removed.concat(data.removed);
        hasMore = data.has_more;
        // Update cursor to the next cursor
        cursor = data.next_cursor;
        prettyPrintResponse(response);
      }

      const compareTxnsByDateAscending = (a, b) => (a.date > b.date) - (a.date < b.date);
      // Return the 8 most recent transactions
      const recently_added = [...added].sort(compareTxnsByDateAscending).slice(-8);
      response.json({latest_transactions: recently_added});
    })
    .catch(next);
});
// Retrieve Identity for an Item
app.get('/api/identity', function (request, response, next) {
  Promise.resolve()
    .then(async function () {
      const identityResponse = await client.identityGet({
        access_token: ACCESS_TOKEN,
      });
      prettyPrintResponse(identityResponse);
      response.json({ identity: identityResponse.data.accounts });
    })
    .catch(next);
});

// Retrieve real-time Balances for each of an Item's accounts
app.get('/api/balance', function (request, response, next) {
  Promise.resolve()
    .then(async function () {
      const balanceResponse = await client.accountsBalanceGet({
        access_token: ACCESS_TOKEN,
      });
      prettyPrintResponse(balanceResponse);
      response.json(balanceResponse.data);
    })
    .catch(next);
});

// Retrieve information about an Item
app.get('/api/item', function (request, response, next) {
  Promise.resolve()
    .then(async function () {
      // Pull the Item - this includes information about available products,
      // billed products, webhook information, and more.
      const itemResponse = await client.itemGet({
        access_token: ACCESS_TOKEN,
      });
      // Also pull information about the institution
      const configs = {
        institution_id: itemResponse.data.item.institution_id,
        country_codes: PLAID_COUNTRY_CODES,
      };
      const instResponse = await client.institutionsGetById(configs);
      prettyPrintResponse(itemResponse);
      response.json({
        item: itemResponse.data.item,
        institution: instResponse.data.institution,
      });
    })
    .catch(next);
});

// Retrieve an Item's accounts
app.get('/api/accounts', function (request, response, next) {
  Promise.resolve()
    .then(async function () {
      const accountsResponse = await client.accountsGet({
        access_token: ACCESS_TOKEN,
      });
      prettyPrintResponse(accountsResponse);
      response.json(accountsResponse.data);
    })
    .catch(next);
});
//-----Plaid-end------------------------------------------//

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

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
