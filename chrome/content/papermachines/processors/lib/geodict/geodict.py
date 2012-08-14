#!/usr/bin/env python

# Geodict
# Copyright (C) 2010 Pete Warden <pete@petewarden.com>
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.

import csv, os, os.path, sqlite3, sys, json, csv
import geodict_lib, cliargs
import cProfile

args = {
    'input': {
        'short': 'i',
        'type': 'optional',
        'description': 'The name of the input file to scan for locations. If none is set, will read from STDIN',
        'default': '-'
    },
    'output': {
        'short': 'o',
        'type': 'optional',
        'description': 'The name of the file to write the location data to. If none is set, will write to STDOUT',
        'default': '-'
    },
    'format': {
        'short': 'f',
        'type': 'optional',
        'description': 'The format to use to output information about any locations found. By default it will write out location names separated by newlines, but specifying "json" will give more detailed information',
        'default': 'text'
    }
};

options = cliargs.get_options(args)

input = options['input']
output = options['output']
format = options['format']

if input is '-':
    input_handle = sys.stdin
else:
    try:
        input_handle = open(input, 'rb')
    except:
        die("Couldn't open file '"+input+"'")
        
if output is '-':
    output_handle = sys.stdout
else:
    try:
        output_handle = open(output, 'wb')
    except:
        die("Couldn't write to file '"+output+"'")
        
text = input_handle.read()

#cProfile.run('locations = geodict_lib.find_locations_in_text(text)')

locations = geodict_lib.find_locations_in_text(text)

output_string = ''
if format.lower() == 'json':
    output_string = json.dumps(locations)
    output_handle.write(output_string)
elif format.lower() == 'text':
    for location in locations:
        found_tokens = location['found_tokens']
        start_index = found_tokens[0]['start_index']
        end_index = found_tokens[len(found_tokens)-1]['end_index']
        output_string += text[start_index:(end_index+1)]
        output_string += "\n"
    output_handle.write(output_string)
elif format.lower() == 'csv':
    writer = csv.writer(output_handle)
    writer.writerow(['location', 'type', 'lat', 'lon'])
    for location in locations:
        found_tokens = location['found_tokens']
        start_index = found_tokens[0]['start_index']
        end_index = found_tokens[len(found_tokens)-1]['end_index']
        name = text[start_index:(end_index+1)]
        type = found_tokens[0]['type'].lower()
        lat = found_tokens[0]['lat']
        lon = found_tokens[0]['lon']
        writer.writerow([name, type, lat, lon])
else:
    print "Unknown output format '"+format+"'"
    exit()
    
