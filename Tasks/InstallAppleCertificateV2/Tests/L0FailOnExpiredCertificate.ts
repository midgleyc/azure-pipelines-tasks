import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import os = require('os');

let taskPath = path.join(__dirname, '..', 'preinstallcert.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('certSecureFile', 'mySecureFileId');
tr.setInput('certPwd', 'mycertPwd');
tr.setInput('keychain', 'temp');

process.env['AGENT_VERSION'] = '2.116.0';
process.env['AGENT_TEMPDIRECTORY'] = '/build/temp';
process.env['HOME'] = '/users/test';

let secureFileHelperMock = require('securefiles-common/securefiles-common-mock');
tr.registerMock('securefiles-common/securefiles-common', secureFileHelperMock);

tr.registerMock('fs', {
    writeFileSync: function (filePath, contents) {
    }
});

// Mock Math.random() to always return the same value for our tests.
Math.random = function (): number {
    return 1337;
}

// 24 hours ago
// This date string is generated to ensure the positive test, L0CertificateValid.ts, is actually testing expiration times.
const expiredDate: Date = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "openssl": "/usr/bin/openssl"
    },
    "checkPath": {
        "/usr/bin/openssl": true
    },
    "exec": {
        "/usr/bin/openssl pkcs12 -in /build/temp/mySecureFileId.filename -nokeys -passin pass:mycertPwd | /usr/bin/openssl x509 -noout -fingerprint -subject -dates": {
            "code": 0,
            "stdout": `MAC verified OK\nSHA1 Fingerprint=BB:26:83:C6:AA:88:35:DE:36:94:F2:CF:37:0A:D4:60:BB:AE:87:0C\nsubject= /UID=ZD34QB2EFN/CN=iPhone Developer: Madhuri Gummalla (HE432Y3E2Q)/OU=A9M46DL4GH/O=Madhuri Gummalla/C=US\nnotBefore=Nov 13 03:37:42 2017 GMT\nnotAfter=${toOpensslString(expiredDate)}\n`
        }
    }
};
tr.setAnswers(a);

os.platform = () => {
    return 'darwin';
}
tr.registerMock('os', os);

tr.run();

// Return a UTC date in this format: "Nov 13 03:37:42 2018 GMT"
function toOpensslString(datetime: Date): string {
    const dateSegments: string[] = datetime.toUTCString().split(' ');

    if (dateSegments.length != 6) {
        throw new Error('Expected 6 segments in the date string');
    }

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toString
    const date = dateSegments[1];
    const monthName = dateSegments[2];
    const year = dateSegments[3];
    const time = dateSegments[4];

    return `${monthName} ${date} ${time} ${year} GMT`;
}
