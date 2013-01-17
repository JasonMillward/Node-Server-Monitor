/**
 * Node.js Server status 'server'
 *
 * Gathers server information through the use of shell commands
 * Uses websockets and json to
 *
 *
 * Released under the MIT license
 *
 * @copyright  2012 jCode
 * @category   Server Status
 * @version    $Id$
 * @author     Jason Millward <jason@jcode.me>
 * @license    http://opensource.org/licenses/MIT
 * @package    jCode Lab
 */

"use strict";

/**
 *  This is the process title that will be displayed
 *  when viewed under 'ps aux'
 */
process.title = 'Node Server-Status';

/**
 *  Define the websocket servers port
 *
 *  Specify if debug is enabled
 *
 *  Initialise count to be 0
 */
var wSSp  = 2468;
var debug = true;
var count = 0;

/**
 *  Include all of the functions/libs we will be using
 */
var sys  = require('util'),
    http = require('http'),
    url  = require('url'),
    net  = require('net'),
    wSS  = require('websocket').server,
    exec = require("exec-sync");

/**
 *  Define the host and ports (or port scanning)
 */
var host = "jCode.me";
var ports = [
            ['HTTP',    80,     false],
            ['HTTPS',   443,    false],
            ['FTP',     21,     false],
            ['POP3',    110,    false],
            ['SMTP',    25,     false],
            ['MySQL',   3306,   false]
];

/**
 * Adds an extra 0 infront of numbers that are
 *  less then 2 characters in length
 *
 * @param   int     number  number to pad (if at all)
 * @return  int
 */
function pad2(number) {
     return (number < 10 ? '0' : '') + number
}

/**
 * Scans all defined ports in var ports
 *  and checks to see if they are up
 *
 * @return null
 */
function scanHosts() {
    var results

    try {
        ports.forEach(function(item) {
            var sock = new net.Socket();
            sock.setTimeout(2500);
            sock.on('connect', function() {
                item[2] = true;
                sock.destroy();
            }).on('error',   function(e) {
            }).on('timeout', function(e) {
            }).connect(item[1], host);
        });
    } catch (e) {
        //console.log(e);
    }

    return
}

/**
 * List drives using df, excluding all temp file systems
 *  Replace all occurances of 2 or more spaces with a single space
 *  Get the drive percentage and mount point and put then in the
 *      return array
 *
 * @return array
 */
function scanDrives () {
    var retData = [];
    var df      = exec("df -ml --exclude-type=tmpfs");
    var lines   = df.split("\n");
    var len     = lines.length;

    for (var i = 1; i < len; i++) {
        var line  = lines[i].toLowerCase().replace( /[" "]{2,}/g , ' ');
        var drive = line.split(" ");

        var obj = {
            percent:    drive[4],
            mount:      drive[5]
        };
        retData.push(obj);
    }
    return retData;
}

/**
 * If debug is enabled, log a message to the console
 *  with the current time.
 *
 * @param  string   logStr  Message to log to the console
 */
function log(logStr) {
    if (debug) {
        var currentTime, h, m, s;

        currentTime = new Date;
        h = pad2(currentTime.getHours());
        m = pad2(currentTime.getMinutes());
        s = pad2(currentTime.getSeconds());

        try {
            console.log("[" + h + ":" + m + ":" + s + "]\t" + logStr);
        } catch (e) {}
    }
}

/**
 * Gets the number of cpus hiding in /proc/cpuinfo
 * @return string
 */
function getCPUs() {
    return exec("cat /proc/cpuinfo | grep processor | wc -l");
}

/**
 * Returns the load average
 * @return string
 */
function getLoad() {
    var logString = exec("uptime");
    var t = logString.split("load average: ");

    return t[1].split(", ");
}

/**
 * Finds the first occurence of CPU MHz and returns the string without spaces
 * @return string
 */
function getMHz() {
    return exec('lscpu | grep "CPU MHz:" | sed s/"CPU MHz:"// | sed s/" "//g');
}

/**
 * Gets the current uptime as a timestamp
 * @return string
 */
function getUptime() {
    return exec("cat /proc/uptime | cut -d' ' -f1-1");
}

/**
 * Gets the total ammount of memory available to the system and returns it
 * @return string
 */
function MemTotal() {
    return exec('cat /proc/meminfo | grep "MemTotal:" | sed s/"MemTotal:"// | sed s/" "//g | sed s/"kb"//gi');
}

/**
 * Gets the ammount of free memory left in the system and returns it
 * @return string
 */
function getMemFree() {
    return exec('cat /proc/meminfo | grep "MemFree:" | sed s/"MemFree:"// | sed s/" "//g | sed s/"kb"//gi' );
}

/**
 * Gets the current sent and recived bytes on the first ethernet port
 * @return string
 */
function getNetSpeed() {
    var ret = [];

    ret.push( exec("cat /sys/class/net/eth0/statistics/tx_bytes") );
    ret.push( exec("cat /sys/class/net/eth0/statistics/rx_bytes") );

    return ret;
}

/**
 *
 *
 */
var server = http.createServer(function(request, response) {});

/**
 *
 */
server.listen(wSSp, function() {
    log("Server is listening on port " + wSSp);
});

/**
 *
 */
var wsServer = new wSS({
    httpServer: server
});


wsServer.on('request', function(request) {

    var connection = request.accept(null, request.origin);
    var oldNetwork = [];
    var newNetwork = [];
    var time = getUptime();
    scanHosts();
    count++;



    log('Connection from origin ' + request.origin + '.');
    log("Peer " + connection.remoteAddress + " connected.");

    if ( count > 5 ) {
        connection.sendUTF(JSON.stringify( { type: 'error', data: 'Too many connections'} ));
        connection.sendCloseFrame(32001, "Too many connections" ,true);
    } else {
        connection.sendUTF(JSON.stringify( { type: 'uptime', data: time} ));
    }

    connection.on('message', function(message) {
        if (message.type === 'utf8') {

            /**
             * [logString description]
             */
            var logString   = "";
            var data        = [];
            var load        = getLoad();
            var CPUs        = getCPUs();
            var speed       = getMHz();
            var free        = getMemFree();
            var total       = MemTotal();
            var drives      = scanDrives();

            /**
             * [newNetwork description]
             */
            newNetwork = getNetSpeed();

            var tx = newNetwork[0] - oldNetwork[0];
            var rx = newNetwork[1] - oldNetwork[1];
            oldNetwork = newNetwork;


            /**
             * [obj description]
             */
            var obj = {
                now:        load[0],
                five:       load[1],
                fifteen:    load[2],
                count:      CPUs,
                MHz:        speed,
                free:       free,
                total:      total,
                drives:     drives,
                ports:      ports,
                tx:         tx,
                rx:         rx
            };
            data.push(obj);

            /**
             *  Send the client a nice json string from which it can interpret all the data provided
             */
            connection.sendUTF(JSON.stringify( { type: 'message', data: data} ));
        }
    });

    /**
     * [description]
     */
    connection.on('close', function(connection) {
        count--;
        log("Peer " + connection.remoteAddress + " disconnected.");
    });

});