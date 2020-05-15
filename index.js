const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const app = express();
const fse = require('fs-extra');
const exec = require('child_process').execSync;
const os = require('os');
const process = require('process');

const config = {
    name: 'cryo-recipes-db',
    port: 3000,
    host: '0.0.0.0',
};

// just read into mem
const repoUrl = "git@github.com:slaclab/cryo-recipes-db.git";
const repoPath = "/tmp/master/";
const dbPath = 'data/papers.json';

// express settings
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());


// set the ssh key to use
console.log( "Using "  + process.env.GIT_SSH_COMMAND );
exec( "git --version" );

// grab newest db from repoUrl and read into memory
console.log("Cloning " + repoUrl + " to " + repoPath );
const repoDbPath = repoPath + dbPath;
var db = null;
fse.remove( repoPath )
.then( () => {
  console.log('getting current version of database...');
  exec( "git clone " + repoUrl + " " + repoPath);
  // read db into mem
  fse.readJson( repoDbPath )
  .then( obj => {
    db = obj;
    // start server
    app.listen(config.port, config.host, (err)=> {
      if(err) {
        throw new Error('Could not start server.');
      }
      console.log("Ready...")
    });
  })
  .catch( err => {
    console.error(err);
    process.exit(255);
  })
})

// liviness check
app.get('/status', (req,res) => {
  if( db == null ){
    res.status(404);
  } else {
    res.send('ok!');
  }
})

// list all papers
app.get('/api/papers.json', (req, res) => {
  if( db == null ) {
    res.status(404)
  } else {
    res.send( db );
  }
})



var submitPR = ( branchName, newdb ) => {

  var dir = path.resolve( '/tmp/' + branchName );

  return new Promise( (resolve,reject) => {

    // duplicate master
    rmdir( dir );
    fse.copySync( repoPath, dir );
    console.log("creating new branch " + branchName + " at " + dir );
  
    process.chdir(dir);
    exec( "git checkout -b " + branchName );
    const newdbPath = dir + '/' + dbPath;
    var d = fs.createWriteStream(newdbPath)
    d.on( 'finish', () => {
      // commit changes
      exec( 'git config user.name "author" && git config user.email "author@somewhere.org"' );
      exec( "git commit -m 'new entry request' . && git push -u origin " + branchName );
      // hmm.. need different auth for hub
      // exec( "hub pull-request -m 'new entry request' -b cryo-recipes:" + branchName + " -h cryo-recipes:master");
      // create PR
      // rmdir( dir );
    });
    d.on("error", (err) => {
      console.error(err);
      reject(err);
    });
    d.write( JSON.stringify(newdb, null, 2) );
    d.end();

    process.chdir( repoPath );
    resolve( newdb );
  })
}

// add new paper 
app.put('/api/paper/new', (req, res) => {
  const item = req.body;
  console.log(item);
  
  // copy
  db2 = JSON.parse( JSON.stringify(db) );
  db2.push( item );

  // create new branch
  var branchName = 'new';
  var pr_promise = submitPR( branchName, db2 )
  .then( (d) => {
    res.status(200).send(item);
  })
  .catch( (err) => {
    res.status(500)
  });

})

// get single paper
app.get('/api/paper/:id', (req, res) => {
  const id = req.params.id;
  res.send(db[id]);
})


app.post( '/api/paper/:id', (req, res) => {

  var id = req.params.id;

  // modify entry
  var db2 = JSON.parse( JSON.stringify(db) );
  db2[id] = req.body;

  var branchName = 'mod-' + id;
  var pr_promise = submitPR( branchName, db2 );

  // clean up
  res.status(200).send(db2[id]);

})

