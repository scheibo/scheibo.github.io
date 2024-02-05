require('source-map-support').install();

import * as path from 'path';

import {serve} from 'site';

const root = path.join(__dirname, '..');
serve(Number(process.env.PORT) || 8968, {root, static: path.join(root, 'src')});
