var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const expressSesssion = require('express-session');
const passport = require('passport');
const { Issuer, Strategy } = require('openid-client');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);

Issuer.discover('http://localhost:3333')
  .then(myIssuer => {
    var client = new myIssuer.Client({
      client_id: 'oidcCLIENT',
      client_secret: 'secret',
      redirect_uris: [ 'http://localhost:3000/auth/callback' ],
      // response_types: ['code', 'id_token'], // without code is default
      post_logout_redirect_uris: [ 'http://localhost:3000/logout/callback' ],
      token_endpoint_auth_method: 'client_secret_post',
      // scope: 'openid email profile' // put here doesn't work, must put in passport authentication auguments
    });

    app.use(
      expressSesssion({
        secret: 'keyboard cat',
        resave: false,
        saveUninitialized: true
      })
    );

    app.use(passport.initialize());
    app.use(passport.session());

    passport.use(
      'oidc',
      new Strategy({ client }, (tokenSet, userinfo, done) => {
        return done(null, tokenSet.claims());
      })
    );

    // handles serialization and deserialization of authenticated user
    passport.serializeUser(function(user, done) {
      done(null, user);
    });
    passport.deserializeUser(function(user, done) {
      done(null, user);
    });

    // start authentication request
    app.get('/auth', (req, res, next) => {
      passport.authenticate('oidc', 
        { scope: 'openid email profile' } // scope openid is minimum or causing Error in callback: id_token not present in TokenSet
      )(req, res, next);
    });

    // authentication callback
    app.get('/auth/callback', (req, res, next) => {
      passport.authenticate('oidc', {
        successRedirect: '/users',
        failureRedirect: '/'
      })(req, res, next);
    });

    app.use('/users', usersRouter);

    // start logout request
    app.get('/logout', (req, res) => {
      client.endSessionUrl()
      req.logout()
      cookie = req.cookies;
      for (var prop in cookie) {
          if (!cookie.hasOwnProperty(prop)) {
              continue;
          }    
          res.cookie(prop, '', {expires: new Date(0)});
      }
      res.redirect('/');
    });

    // logout callback
    app.get('/logout/callback', (req, res) => {
      console.log(res)
      // clears the persisted user from the local storage
      req.logout();
      // redirects the user to a public route
      res.redirect('/');
    });


    // catch 404 and forward to error handler
    app.use(function(req, res, next) {
      next(createError(404));
    });

    // error handler
    app.use(function(err, req, res, next) {
      // set locals, only providing error in development
      res.locals.message = err.message;
      res.locals.error = req.app.get('env') === 'development' ? err : {};

      // render the error page
      res.status(err.status || 500);
      res.render('error');
    });
  });

module.exports = app;