#!/usr/bin/env node

'use strict';

var child = require('child_process');

child.exec('rm -rf ./db/*');
child.exec('git checkout ./db');
