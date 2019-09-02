const express = require('express');
require('dotenv').config();

const router = require('./router');
require('./worker');

const app = express();

app.use('', router);
app.set('port', 3000);
app.listen(app.get('port'), () => {
    console.log('App is running at http://localhost:%d', app.get('port'));
});

module.exports = app;
