var chai = require('chai')
  , tracery = require('tracery')
  , numbers = require('number-words')
  , greg = require('greg')
  , expect = chai.expect;
chai.should();
chai.use(require('chai-interface'));



function randomRepoName(){
 var s = greg.sentence()
  ,  reg=/(\d+)/;  
 return s.replace(reg, numbers.stringify(s.match(reg)[1])).replace(/[^\w+]+/g, '-');
};

function assertRepoInterface(repo) {
  repo.should.have.interface({
      'git_url': String
    , 'ssh_url': String
    , 'clone_url': String
    , 'fork': Boolean
    , 'name': String
    , 'full_name': String
  });
};


function assertDirItemInterface(dirItem) {
  dirItem.should.have.interface({
      'name': String
    , 'path': String
    , 'size': tracery.Nullable(Number)
    , 'sha': String
    , 'type': String
  });
};


function assectGitProviderInterface(gitProvider) {
  gitProvider.should.have.interface({
      authenticatedUserGet: Function
    , reposGet: Function
    , repoCreate: Function
    , repoDelete: Function
    , repoFork: Function
    , repoGetContents: Function
    , repoFileGet: Function
    , repoFileUpdate: Function
    , repoFileCreate: Function
    , repoFileDelete: Function
  });
}

var CREATE_REPO_NAME = randomRepoName()
  , FORKED_REPO = "git://github.com/joyent/node.git"
  , FORKED_REPO_NAME = "node"
  , READ_REPO_NAME = "node-slug"
  , READ_WRITE_REPO_NAME = randomRepoName();


module.exports = function(gitProviderName, gitProviderOpts) {
  return function(){
    var gitProvider = require('../')(gitProviderName, gitProviderOpts);
    
    var cleanRepos = function(cb) {
      gitProvider.repoDelete(CREATE_REPO_NAME, function(err, result){
        gitProvider.repoDelete(FORKED_REPO_NAME, function(err, result){
          cb(null);
        });
      });
    };
    describe("Interface", function(){
      it("should be proper", function(){
        assectGitProviderInterface(gitProvider);
      });
    });

    describe("User", function(){
      it("should be authenticated", function(done) {
        expect(gitProvider).to.be.ok;
        gitProvider.authenticatedUserGet(function(err, user){
          expect(err).to.be.null;
          user.should.be.ok;
          done();
        });
      });
    });
    describe("Repo", function(){
      before(cleanRepos);
      after(cleanRepos);
      it("should be listed for user", function(done){
        gitProvider.reposGet(function(err, repo){
          expect(err).to.be.null;
          repo.should.be.ok;
          expect(repo).to.be.not.empty;
          repo.forEach(function(repo) {
            assertRepoInterface(repo);
          });
          done();
        });
      });
      it("should be created", function(done){
        gitProvider.repoCreate(CREATE_REPO_NAME, function(err, repo){
          expect(err).to.be.null;
          assertRepoInterface(repo);
          repo.name.should.be.equal(CREATE_REPO_NAME);
          done();
        });
      })
      it("should be deleted", function(done){
        gitProvider.repoDelete(CREATE_REPO_NAME, function(err, result){
          expect(err).to.be.null;
          result.should.be.ok;
          done();
        });
      });
      xit("should be forked", function(done){
        gitProvider.repoFork(FORKED_REPO, function(err, repo){
          expect(err).to.be.null;
          assertRepoInterface(repo);
          done();
        });
      });
      it("should list the root repo content", function(done){
        gitProvider.repoGetContents({
            repo:READ_REPO_NAME
          , path: ""
          , ref: null
        }, function(err, contents){
          expect(err).to.be.null;
          contents.should.not.be.empty;
          contents.length.should.be.equal(9);
          contents.forEach(function(item){
            assertDirItemInterface(item);
          });
          done();
        });
      });
      it("should list the repo content in directory path", function(done){
        gitProvider.repoGetContents({
            repo:READ_REPO_NAME
          , path: "src"
          , ref: null
        }, function(err, contents){
          expect(err).to.be.null;
          contents.should.be.ok;
          contents.should.not.be.empty;
          contents.length.should.be.equal(1);
          contents.forEach(function(item){
            assertDirItemInterface(item);
          });
          done();
        });

      });


    });
    describe("High-level file operations", function(){

      var FILE_COMMIT = null
        , FILE_PATH = "README.md";

      var OLD_CONTENT = null;

      before(function(done){
        gitProvider.repoCreate(READ_WRITE_REPO_NAME, function(err, repo){
          if (err) throw err;
          done();
        });

      });

      after(function(done){
        gitProvider.repoDelete(READ_WRITE_REPO_NAME, function(err, repo){
          if (err) throw err;
          done();
        });

      });

      it("should get the file at path", function(done){
        gitProvider.repoFileGet({
            repo:READ_WRITE_REPO_NAME
          , path: FILE_PATH
          , ref: null
        }, function(err, file, sha){
          expect(err).to.be.null;
          file.should.be.ok;
          sha.should.be.ok
          FILE_COMMIT = sha; 
          OLD_CONTENT = file;
          done();
        });
      });

      var NEW_CONTENT = "content \n by \n git provider test";
      it("should update the file at path", function(done){
        gitProvider.repoFileUpdate({
            repo:READ_WRITE_REPO_NAME
          , path: FILE_PATH
          , message: FILE_PATH +" is updated by test"
          , content: NEW_CONTENT
          , branch: null
        }, function(err){
          expect(err).to.be.null;
          done();
        });
      });
      it("should persist", function(done){
        gitProvider.repoFileGet({
            repo:READ_WRITE_REPO_NAME
          , path: FILE_PATH
          , ref: null
        }, function(err, file, sha){
          expect(err).to.be.null;
          file.should.be.ok;
          file.should.be.equal(NEW_CONTENT);

          done();
        });
      });

      xit("should be able to traverse back in history to get old revision", function(done){
        gitProvider.repoFileGet({
            repo:READ_WRITE_REPO_NAME
          , path: FILE_PATH
          , ref: FILE_COMMIT
        }, function(err, file){
          expect(err).to.be.null;
          file.should.be.ok;

          done();
        });
      });
      var NEW_FILE_PATH = "some.txt";
      var NEW_FILE_CONTENT = "new file content!";
      it("should create the file at path", function(done){
        gitProvider.repoFileCreate({
            repo:READ_WRITE_REPO_NAME
          , path: NEW_FILE_PATH
          , content: NEW_FILE_CONTENT
          , message: NEW_FILE_PATH + " is created by test"
          , branch: null
        }, function(err){
          expect(err).to.be.null;
          done();
        });
      });


      it("should persist after creation", function(done){
        gitProvider.repoFileGet({
            repo:READ_WRITE_REPO_NAME
          , path: NEW_FILE_PATH
          , ref: null
        }, function(err, file, sha){
          expect(err).to.be.null;
          file.should.be.ok;
          file.should.be.equal(NEW_FILE_CONTENT);

          done();
        });
      });

      it("should delete the file at path", function(done){
        gitProvider.repoFileDelete({
            repo:READ_WRITE_REPO_NAME
          , path: NEW_FILE_PATH
          , branch: null
        }, function(err){
          expect(err).to.be.null;
          done();
        });
      });

      it("should do not exist after removing", function(done){
        gitProvider.repoFileGet({
            repo:READ_WRITE_REPO_NAME
          , path: NEW_FILE_PATH
          , ref: null
        }, function(err, file, sha){
          expect(err).to.be.ok;
          expect(sha).to.be.null;
          done();
        });
      });


    });
  };
};
