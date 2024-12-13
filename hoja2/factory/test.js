import Rgbconfig from './parsers/rgbConfig.js'
import Analogpackeddistances from './parsers/analogPackedDistances.js';

// RGBconfig tests passed.
// 

const buffer = new Uint8Array([ 64, 226, 1, 0, 0, 0, 10, 0, 20, 0, 30, 0, 40, 0, 50, 0, 60, 0, 70, 0, 80, 0, 90, 0, 100, 0, 110, 0, 120, 0, 130, 0, 140, 0, 150, 0, 160, 0, 170, 0, 180, 0, 190, 0, 200, 0, 210, 0, 220, 0, 230, 0, 240, 0, 250, 0, 4, 1, 14, 1, 24, 1, 34, 1, 44, 1, 54, 1, 64, 1, 74, 1, 84, 1, 94, 1, 104, 1, 114, 1, 124, 1, 134, 1, 144, 1, 154, 1, 164, 1, 174, 1, 184, 1, 194, 1, 204, 1, 214, 1, 224, 1, 234, 1, 244, 1, 254, 1, 8, 2, 18, 2, 28, 2, 38, 2, 48, 2, 58, 2, 68, 2, 78, 2, 88, 2, 98, 2, 108, 2 ]);

let test = new Analogpackeddistances(buffer);

console.log(test.first_distance);

test.first_distance = 123456;

console.log(test.first_distance);
