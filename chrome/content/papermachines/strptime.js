/**
 * https://github.com/cho45/micro-strptime.js
 * (c) cho45 http://cho45.github.com/mit-license
 */
let EXPORTED_SYMBOLS = ["strptime"];

function strptime (str, format) {
	if (!format) throw Error("Missing format");
	var ff = [];
	var re = new RegExp(format.replace(/%(?:([a-zA-Z%])|('[^']+')|("[^"]+"))/g, function (_, a, b, c) {
		var fd = a || b || c;
		var d  = strptime.fd[fd];
		if (!d) throw Error("Unknown format descripter: " + fd);
		ff.push(d[1]);
		return '(' + d[0] + ')';
	}), 'i');
	var matched = str.match(re);
	if (!matched) throw Error('Failed to parse');

	var date = new Date(0);
	for (var i = 0, len = ff.length; i < len; i++) {
		var fun = ff[i];
		if (!fun) continue;
		fun.call(date, matched[i + 1]);
	}
	if (date.timezone) {
		date = new Date(date.getTime() - date.timezone * 1000);
	}
	if (date.AMPM) {
		if (date.getUTCHours() == 12) date.setUTCHours(date.getUTCHours() - 12);
		if (date.AMPM == 'PM') date.setUTCHours(date.getUTCHours() + 12);
	}
	return date;
}
strptime.fd = {
	'%' : [ '%', function () {} ],
	'A' : [ '[a-z]+', function (matched) {} ],
	'B' : [ '[a-z]+', function (matched) { this.setUTCMonth(strptime.B[matched.slice(0, 3)]) } ],
	'Y' : [ '[0-9]{4}', function (matched) { this.setUTCFullYear(+matched) } ],
	'y' : [ '[0-9]{2}', function (matched) { this.setUTCFullYear(+matched + (+matched > (new Date().getYear() - 100) ? 1900 : 2000)) } ],
	'm' : [ '[0-9]{1,2}', function (matched) { this.setUTCMonth(+matched - 1) } ],
	'd' : [ '[0-9]{1,2}', function (matched) { this.setUTCDate(+matched) } ],
	'H' : [ '[0-9]{1,2}', function (matched) { this.setUTCHours(+matched) } ],
	'M' : [ '[0-9]{2,2}', function (matched) { this.setUTCMinutes(+matched) } ],
	'S' : [ '[0-9]{2,2}', function (matched) { this.setUTCSeconds(+matched) } ],
	's' : [ '[0-9]+', function (matched) { this.setUTCMilliseconds(+matched) } ],
	'Z' : [ 'UTC|Z|[+-][0-9][0-9]:?[0-9][0-9]', function (matched) {
		if (matched == 'Z') return;
		if (matched == 'UTC') return;
		// '+09:00' or '+0900'
		matched = matched.replace(/:/, '');
		this.timezone = (+matched.slice(0, 3) * (60 * 60)) + (+matched.slice(3, 5) * 60);
	} ],
	'I' : [ '[0-9]{0,2}', function (matched) { this.setUTCHours(+matched) } ],
	'p' : [ 'AM|PM', function (matched) { this.AMPM = matched } ]
};

strptime.B = { "Jan": 0, "Feb": 1, "Mar": 2, "Apr": 3, "May": 4, "Jun": 5, "Jul": 6, "Aug": 7, "Sep": 8, "Oct": 9, "Nov": 10, "Dec": 11 };
