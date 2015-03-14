// dependencies
var async = require('async');
var AWS = require('aws-sdk');
var im = require('imagemagick');
var util = require('util');
var fs = require('fs');

// get reference to S3 client 
var s3 = new AWS.S3();

exports.handler = function(event, context) {
  // Read options from the event.
  console.log("Reading options from event:\n", util.inspect(event, {depth: 5}));
  var srcBucket = event.Records[0].s3.bucket.name;
  var srcKey    = event.Records[0].s3.object.key;
  var dstBucket = srcBucket + "-resized";

  // Sanity check: validate that source and destination are different buckets.
  if (srcBucket == dstBucket) { console.log("Destination bucket must not match source bucket."); return; }

  // Infer the image type.
  var typeMatch = srcKey.match(/\.([^.]*)$/);
  if (!typeMatch) { console.log('unable to infer image type for key ' + srcKey); return; }
  var imageType = typeMatch[1];
  if (imageType != "pdf") { console.log('skipping non-image ' + srcKey); return; }

  process.chdir('/tmp');
  var pdfFile = 'file.pdf';
  var maxSlideNumber = 30;
  var slideRange = '[0-' + maxSlideNumber + ']';

  async.waterfall([
      function download(next) {
        s3.getObject({
          Bucket: srcBucket,
          Key: srcKey
        }, function(err,data) {
          if (err) throw err;
          next(null, data);
        });
      },
      function write(response, next) {
        fs.writeFile(pdfFile, response.Body, next);
      },
      function tranform(next) {
        var params = ['-resize', '1024', '-density', '150', pdfFile + slideRange, '-quality', '100', 'out.jpg'];
        console.log("transform", params);
        im.convert(params, next);
      }, function iterate(stdout, stderr, next) {
        im.identify(['-format', '%n', 'file.pdf'], next);
      }, function upload(count, next) {
        count = parseInt(count);
        console.log("upload", count);
        var filenames = [];
        for(var i = 0; i < Math.min(count, maxSlideNumber); i++) {
          var baseName = 'out-'+ i + '.jpg';
          filenames.push(baseName);
        }
        var upload = function(baseName, next) {
            async.waterfall([
              function(next) { fs.readFile(baseName, next) },
              function(data, next) { 
                var dstKey = baseName;
                console.log("Uploading ", baseName);
                s3.putObject({ Bucket: dstBucket, Key: dstKey, Body: data, ContentType: 'image/jpeg' }, next);
              }], next);
        }
        async.map(filenames, upload, next);
      }], function (err) {
        if (err) console.log('An error happened: ' + err);
        else console.log('Successfully resized ' + srcBucket + '/' + srcKey + ' and uploaded to ' + dstBucket);
        context.done();
      }
  );
};
