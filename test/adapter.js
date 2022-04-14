/* This code is copied from @cumulus/deployment library with added function downloadCMA */
/* eslint-disable no-console, no-param-reassign */

'use strict';

const fs = require('fs-extra');
const path = require('path');
const request = require('request');
const extract = require('extract-zip');

/**
 * `downloadZipfile` downloads zip file from remote location and stores on disk
 *
 * @param {string} fileUrl - URL file location
 * @param {string} localFilename - Where to store file locally
 * @returns {Promise} - resolves `undefined` when download is completed
 */
function downloadZipfile(fileUrl, localFilename) {
  const file = fs.createWriteStream(localFilename);
  const options = {
    uri: fileUrl,
    headers: {
      Accept: 'application/octet-stream',
      'Content-Type': 'application/zip',
      'Content-Transfer-Encoding': 'binary',
    },
  };

  return new Promise((resolve, reject) => {
    request(options, (err, response) => {
      if (err) reject(err);
      if (response.statusCode !== 200) reject(new Error(`${response.statusMessage}: ${fileUrl}`));
    })
      .pipe(file);

    file.on('finish', () => {
      console.log(`Completed download of ${fileUrl} to ${localFilename}`);
      resolve();
    })
      .on('error', reject);
  });
}

/**
 * unzip a given zip file to the given destination
 *
 * @param {string} filename - the zip file to extract
 * @param {string} dst - the destination to extract the file
 * @returns {Promise.<string>} the path of the extracted zip
 */
function extractZipFile(filename, dst) {
  // create the destination folder it doesn't exist
  fs.mkdirpSync(dst);
  return new Promise((resolve, reject) => {
    extract(filename, { dir: dst }, (err) => {
      if (err) return reject(err);
      console.log(`${filename} extracted to ${dst}`);
      return resolve(dst);
    });
  });
}

/**
 * Fetches the latest release version of the cumulus message adapter
 *
 * @param {string} gitPath - path to the cumulus message adapter repo
 * @returns {Promise.<string>} Promise resolution is string of latest github release, e.g. 'v0.0.1'
 */
function fetchLatestMessageAdapterRelease(gitPath) {
  const options = {
    url: `https://api.github.com/repos/${gitPath}/releases/latest`,
    headers: {
      Accept: 'application/json',
      'User-Agent': '@cumulus/deployment', // Required by Github API
    },
  };

  if (process.env.GITHUB_TOKEN) {
    options.headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
  }

  return new Promise((resolve, reject) => {
    request(options, (err, response, body) => {
      if (err) reject(err);
      resolve(JSON.parse(body).tag_name);
    });
  });
}

/**
 * Determine the version of the cumulus-message-adapter to use
 *
 * @param {string} version - the cumulus-message-adapter version (default to null)
 * @param {string} gitPath - path to the cumulus message adapter repo
 * @returns {Promise.<string>} - the message adapter version
 */
function messageAdapterVersion(version, gitPath) {
  if (version) {
    return Promise.resolve(version);
  }
  return fetchLatestMessageAdapterRelease(gitPath);
}

/**
 * The Github URL of the cumulus-message-adapter zip file
 *
 * @param {string} version - the cumulus-message-adapter version (default to null)
 * @param {string} gitPath - path to the cumulus message adapter repo
 * @param {string} filename - the zip file to extract
 * @returns {Promise.<string>} - the URL to fetch the cumulus-message-adapter from
 */
function messageAdapterUrl(version, gitPath, filename) {
  return messageAdapterVersion(version, gitPath)
    .then((ver) => (process.env.GITHUB_TOKEN
      ? `https://github.com/${gitPath}/releases/download/${ver}/${filename}?access_token=${process.env.GITHUB_TOKEN}`
      : `https://github.com/${gitPath}/releases/download/${ver}/${filename}`));
}

/**
 * Determines which release version should be downloaded from
 * cumulus-message-adapter repository and then downloads that file.
 *
 * @param {string} version - the cumulus-message-adapter version (default to null)
 * @param {string} gitPath - path to the cumulus message adapter repo
 * @param {string} filename - the zip file to extract
 * @param {string} src - the path to where the zip file should be downloaded to
 * @param {string} dest - the path to where the zip file should be extracted to
 * @returns {Promise} returns the path of the extracted message adapter or an empty response
 */
function fetchMessageAdapter(version, gitPath, filename, src, dest) {
  return messageAdapterUrl(version, gitPath, filename)
    .then((url) => downloadZipfile(url, src))
    .then(() => extractZipFile(src, dest));
}

/**
 * Download cumulus message adapter (CMA) and unzip it
 *
 * @param {string} srcdir - the directory to where the zip file should be downloaded to
 * @param {string} destdir - the directory to where the zip file should be extracted to
 * @param {string} version - cumulus message adapter version number (optional)
 * @returns {Promise.<Object>} an object with path to the zip and extracted CMA
 */
async function downloadCMA(srcdir, destdir, version) {
  if (process.env.LOCAL_CMA_ZIP_FILE) {
    const dest = path.join(destdir, 'cumulus-message-adapter');
    await extractZipFile(process.env.LOCAL_CMA_ZIP_FILE, dest);
    return { dest };
  }
  // download and unzip the message adapter
  const gitPath = 'nasa/cumulus-message-adapter';
  const filename = 'cumulus-message-adapter.zip';
  const src = path.join(srcdir, 'cumulus-message-adapter.zip');
  const dest = path.join(destdir, 'cumulus-message-adapter');
  await fetchMessageAdapter(version, gitPath, filename, src, dest);
  return { src, dest };
}

module.exports = {
  downloadCMA,
  downloadZipfile,
  extractZipFile,
  fetchLatestMessageAdapterRelease,
  messageAdapterVersion,
  messageAdapterUrl,
  fetchMessageAdapter,
};
