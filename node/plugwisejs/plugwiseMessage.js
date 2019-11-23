"use strict";

var crc = require('crc');
var LogType = require('../logger/logger.js').logType;
var Logger = require('../logger/logger.js').getInstance();

var PlugwiseDeviceType = {
  STICK:{value:0,name:"Stick"},
  CIRCLEPLUS:{value:1,name:"CirclePlus"},
  CIRCLE:{value:2,name:"Circle"},
  SWITCH:{value:3,name:"Switch"},
  SENSE:{value:5,name:"Sense"},
  SCAN:{value:6,name:"Scan"},
  STEALTH:{value:9,name:"Stealth"},
  UNDEFINDED:{value:999,name:"Unknow"},
  getType:function(type){
    switch (type)
    {
      case 0:
        return PlugwiseDeviceType.STICK;
      case 1:
        return PlugwiseDeviceType.CIRCLEPLUS;
      case 2:
        return PlugwiseDeviceType.CIRCLE;
      case 3:
        return PlugwiseDeviceType.SWITCH;
      case 5:
        return PlugwiseDeviceType.SENSE;
      case 6:
        return PlugwiseDeviceType.SCAN;
      case 9:
        return PlugwiseDeviceType.STEALTH;
      default:
        return PlugwiseDeviceType.UNDEFINDED;
    }
  }
}

var TIMEOUT = 3500;
var MAXTRYCOUNT = 5;

var PlugwiseMessageConst = {
  //Pass Full message
  parser:function(data) {
    var regularExpression = new RegExp('(.{4})(\\w{4})(\\w{4})(\\w*)?(\\w{4})');// Header, sequence, Type, messageData, Footer
    var parsed = data.match(regularExpression);
    var out = {};
    if (parsed) {
      out.header = parsed[1];
      out.type = parsed[2];
      out.sequence = parsed[3];
      out.data = parsed[4];
      out.crc = parsed[5];
    }
    Logger.log("InsideParser - Global: " + JSON.stringify(out), LogType.DEBUG);
    return out
  },
  // Pass messageData
  ACKNOWLEDGEMENT_V2:{ //Pass message data without Type
    value:'0100',regEx:'^(\\w{16})(\\w{4})$', // Mac, SubType
    parser:function(data) {
      var regularExpression = new RegExp('^(\\w{16})(\\w{4})$');
      var parsed = data.match(regularExpression);
      var out = {};
      if (parsed) {
        out.mac = parsed[1];
        out.subtype = parsed[2];
      }
      Logger.log("InsideParser - ACKNOWLEDGEMENT: " + JSON.stringify(out), LogType.DEBUG);
      return out
    }
  },
  ACKNOWLEDGEMENT_V1:{ //Pass message data without Type
    value:'0000',regEx:'^(\\w{4})(\\w{16})?$', //SubType, Mac,
    parser:function(data) {
      var regularExpression = new RegExp('^(\\w{4})(\\w{16})?$');
      var parsed = data.match(regularExpression);
      var out = {};
      if (parsed) {
        out.subtype = parsed[1];
        if (parsed[2]) out.mac = parsed[2];
      }
      Logger.log("InsideParser - ACKNOWLEDGEMENT: " + JSON.stringify(out), LogType.DEBUG);
      return out
    }
  },
  ACKNOWLEDGEMENT_SUBTYPE:
  {
    NOTEXTENDED:{value:'0000'},
    SUCCESS:{value:'00C1'},
    ERROR:{value:'00C2'},
    COMMAND_NOT_ALLOW:{value:'00C3'},
    CLOCKSET:{value:'00D7'},
    ON:{value:'00D8'},
    ENABLEJOINING:{value:'00D9'},
    DISABLEJOINING:{value:'00DD'},
    OFF:{value:'00DE'},
    TIMEOUT:{value:'00E1'},
    UNKNOWN:{value:'03E7'}
    /*
            SENSE_INTERVAL_SET_ACK(179),
            SENSE_INTERVAL_SET_NACK(180),
            SENSE_BOUNDARIES_SET_ACK(181),
            SENSE_BOUNDARIES_SET_NACK(182),
            LIGHT_CALIBRATION_ACK(189),
            SCAN_PARAMETERS_SET_ACK(190),
            SCAN_PARAMETERS_SET_NACK(191),

            CIRCLE_PLUS(221),
            CLOCK_SET_ACK(215),
            POWER_CALIBRATION_ACK(218),
            REAL_TIME_CLOCK_SET_ACK(223),
            ON_OFF_NACK(226),
            REAL_TIME_CLOCK_SET_NACK(231),
            SLEEP_SET_ACK(246),
            POWER_LOG_INTERVAL_SET_ACK(248),
            UNKNOWN(999);

      */

    /*
    elsif ( $2 eq "00F9" ) {	                   $xplmsg{text}="Clear group MAC-Table"      ; return \%xplmsg;}
  elsif ( $2 eq "00FA" ) {	                   $xplmsg{text}="Fill Switch-schedule"      ; return \%xplmsg;}
  elsif ( $2 eq "00F7" ) {	                   $xplmsg{text}="Request self-removal from network"      ; return \%xplmsg;}
  elsif ( $2 eq "00F1" ) {	                   $xplmsg{text}="Set broadcast-time interval"      ; return \%xplmsg;}
  elsif ( $2 eq "00F5" ) {	                   $xplmsg{text}="Set handle off"      ; return \%xplmsg;}
  elsif ( $2 eq "00F4" ) {	                   $xplmsg{text}="Set handle on"      ; return \%xplmsg;}
  elsif ( $2 eq "00E6" ) {	                   $xplmsg{text}="Set PN"     ; return \%xplmsg;}
  elsif ( $2 eq "00F8" ) {	                   $xplmsg{text}="Set powerrecording"      ; return \%xplmsg;}
  elsif ( $2 eq "00BE" ) {	                   $xplmsg{text}="Set scan-params ACK"      ; return \%xplmsg;}
  elsif ( $2 eq "00BF" ) {	                   $xplmsg{text}="Set scan-params NACK"      ; $xplmsg{type} = 'err';return \%xplmsg;}
  elsif ( $2 eq "00B5" ) {	                   $xplmsg{text}="Set sense-boundaries ACK"      ; return \%xplmsg;}
  elsif ( $2 eq "00B6" ) {	                   $xplmsg{text}="Set sense-boundaries NACK"      ; $xplmsg{type} = 'err';return \%xplmsg;}
  elsif ( $2 eq "00B3" ) {	                   $xplmsg{text}="Set sense-interval ACK"      ; return \%xplmsg;}
  elsif ( $2 eq "00B4" ) {	                   $xplmsg{text}="Set sense-interval NACK"      ; $xplmsg{type} = 'err';return \%xplmsg;}
  elsif ( $2 eq "00F6" ) {	                   $xplmsg{text}="Set sleep-behavior"      ; return \%xplmsg;}
  elsif ( $2 eq "00E5" ) {	                   $xplmsg{text}="Activate Switch-schedule on"      ; return \%xplmsg;}
  elsif ( $2 eq "00E4" ) {	                   $xplmsg{text}="Activate Switch-schedule off"      ; return \%xplmsg;}
  elsif ( $2 eq "00DD" ) {	                   $xplmsg{text}="Allow nodes to join ACK0"      ; return \%xplmsg;}
  elsif ( $2 eq "00D9" ) {	                   $xplmsg{text}="Allow nodes to join ACK1"      ; return \%xplmsg;}
  elsif ( $2 eq "00C8" ) {	                   $xplmsg{text}="Bootload aborted"      ; $xplmsg{type} = 'err'; return \%xplmsg;}
  elsif ( $2 eq "00C9" ) {	                   $xplmsg{text}="Bootload done"      ; return \%xplmsg;}
  elsif ( $2 eq "00D5" ) {	                   $xplmsg{text}="Cancel read Powermeter-Info Logdata"      ; return \%xplmsg;}
  elsif ( $2 eq "00C4" ) {	                   $xplmsg{text}="Cannot join network"      ; $xplmsg{type} = 'err';return \%xplmsg;}
  elsif ( $2 eq "00C3" ) {	                   $xplmsg{text}="Command not allowed"      ; $xplmsg{type} = 'err';return \%xplmsg;}
  elsif ( $2 eq "00D1" ) {	                   $xplmsg{text}="Done reading Powermeter-Info Logdata"      ; return \%xplmsg;}
  elsif ( $2 eq "00C0" ) {	                   $xplmsg{text}="Ember stack error"      ; $xplmsg{type} = 'err';return \%xplmsg;}
  elsif ( $2 eq "00C5" ) {	                   $xplmsg{text}="Exceeding Tableindex"      ;$xplmsg{type} = 'err'; return \%xplmsg;}
  elsif ( $2 eq "00CF" ) {	                   $xplmsg{text}="Flash erased"      ; return \%xplmsg;}
  elsif ( $2 eq "00C6" ) {	                   $xplmsg{text}="Flash error"      ;  $xplmsg{type} = 'err';return \%xplmsg;}
  elsif ( $2 eq "00ED" ) {	                   $xplmsg{text}="Group-MAC added"      ; return \%xplmsg;}
  elsif ( $2 eq "00EF" ) {	                   $xplmsg{text}="Group-MAC not added"      ; $xplmsg{type} = 'err'; return \%xplmsg;}
  elsif ( $2 eq "00F0" ) {	                   $xplmsg{text}="Group-MAC not removed"      ; $xplmsg{type} = 'err'; return \%xplmsg;}
  elsif ( $2 eq "00EE" ) {	                   $xplmsg{text}="Group-MAC removed"      ; return \%xplmsg;}
  elsif ( $2 eq "00E8" ) {	                   $xplmsg{text}="Image activate ACK"      ; return \%xplmsg;}
  elsif ( $2 eq "00CC" ) {	                   $xplmsg{text}="Image check timeout"      ; $xplmsg{type} = 'err'; return \%xplmsg;}
  elsif ( $2 eq "00CB" ) {	                   $xplmsg{text}="Image invalid"      ; $xplmsg{type} = 'err'; return \%xplmsg;}
  elsif ( $2 eq "00CA" ) {	                   $xplmsg{text}="Image valid"      ; return \%xplmsg;}
  elsif ( $2 eq "00C7" ) {	                   $xplmsg{text}="Node-change accepted"      ; return \%xplmsg;}
  elsif ( $2 eq "00CD" ) {	                   $xplmsg{text}="Ping timeout 1sec"      ; $xplmsg{type} = 'err'; return \%xplmsg;}
  elsif ( $2 eq "00EB" ) {	                   $xplmsg{text}="Pingrun busy"      ; return \%xplmsg;}
  elsif ( $2 eq "00EC" ) {	                   $xplmsg{text}="Pingrun finished"      ; return \%xplmsg;}
  elsif ( $2 eq "00CE" ) {	                   $xplmsg{text}="Public network-info complete"      ; return \%xplmsg;}
  elsif ( $2 eq "00D0" ) {	                   $xplmsg{text}="Remote flash erased"      ; return \%xplmsg;}
  elsif ( $2 eq "00F3" ) {	                   $xplmsg{text}="Reply role changed NOK"      ; $xplmsg{type} = 'err'; return \%xplmsg;}
  elsif ( $2 eq "00F2" ) {	                   $xplmsg{text}="Reply role changed OK"      ; return \%xplmsg;}
  elsif ( $2 eq "00E0" ) {	                   $xplmsg{text}="Send switchblock NACK"      ; $xplmsg{type} = 'err'; return \%xplmsg;}
  elsif ( $2 eq "00DA" ) {	                   $xplmsg{text}="Send calib-params ACK"      ; return \%xplmsg;}
  elsif ( $2 eq "00E2" ) {	                   $xplmsg{text}="Set relais denied"      ; $xplmsg{type} = 'err'; return \%xplmsg;}
  elsif ( $2 eq "00DF" ) {	                   $xplmsg{text}="Set RTC-Data ACK"      ; return \%xplmsg;}
  elsif ( $2 eq "00E7" ) {	                   $xplmsg{text}="Set RTC-Data NACK"      ; $xplmsg{type} = 'err'; return \%xplmsg;}
  elsif ( $2 eq "00D7" ) {	                   $xplmsg{text}="Set year, month and flashadress DONE"      ; return \%xplmsg;}
  elsif ( $2 eq "00BD" ) {	                   $xplmsg{text}="Start Light-Calibration started"      ; return \%xplmsg;}
  elsif ( $2 eq "00E9" ) {	                   $xplmsg{text}="Start Pingrun ACK"      ; return \%xplmsg;}
  elsif ( $2 eq "00EA" ) {	                   $xplmsg{text}="Stop Pingrun ACK"      ; return \%xplmsg;}
  elsif ( $2 eq "00DC" ) {	                   $xplmsg{text}="Syncronize NC ACK"      ; return \%xplmsg;}
  elsif ( $2 eq "00D6" ) {	                   $xplmsg{text}="Timeout Powermeter Logdata"      ; $xplmsg{type} = 'err'; return \%xplmsg;}




  # Process the response of TempHum-Sensor

    if ( $frame
        =~ /^0105([[:xdigit:]]{4})([[:xdigit:]]{16})([[:xdigit:]]{4})([[:xdigit:]]{4})/
        )
     {
     	my $s_id = _addr_l2s($2);

            $xplmsg{dest}=$self->{_plugwise}->{circles}->{$s_id}->{type};
	        $xplmsg{type} = 'humtemp';
	        $xplmsg{showCom}="<< 0105 $1 $2 $3 $4";
	        $xplmsg{text}= ' ';
	        $xplmsg{code} = $frame;
	        $xplmsg{device} = $2;
	        $xplmsg{short} = $s_id;
			$xplmsg{val1} = (hex($3)-3145)/524.30;
			$xplmsg{val2} = (hex($4)-17473)/372.90;
			$xplmsg{unit1} = 'h';
			$xplmsg{unit2} = 'C';

            Log3 $hash,5,Dumper(%xplmsg);

        Log3 $hash,5, "PLUGWISE: Temperature for $s_id set";

        return \%xplmsg;
     }




    */
  },
  NODE_AVAILABLE:{value:'0006', regEx:'(\\w{16})',
  parser:function(data) {
    var regularExpression = new RegExp('^(\\w{16})$');
    var parsed = data.match(regularExpression);
    var out = {};
    if (parsed) {
      out.mac = parsed[1];
    }
    Logger.log("InsideParser - NODE_AVAILABLE: " + JSON.stringify(out), LogType.DEBUG);
    return out
  }},
  NEW_NODE_ACCEPTED_REQUEST:{value:'0007', format:function(device,data) {
    return data; //00 mean rejected and 01 accepted + new Mac address receive form NODE_AVAILABLE message , ie 01 000D6F0000D3595D
  }},
  ENABLEJOINING_REQUEST:{value:'0008', format:function(device,data) { // Ou alors c'est un allow new node?
    return data.toString(16).pad(2); //00 or 01 ???
  },timeout: 20000, maxTryCount:16},
  INITIALISE_REQUEST:{value:'000A', format:function(device,data) {
    return '';
  }},
  INITIALISE_RESPONSE:{value:'0011', regEx:'(\\w{16})(\\w{2})(\\w{2})(\\w{16})(\\w{4})(\\w{2})',
  parser:function(data) {
    var regularExpression = new RegExp('^(\\w{16})(\\w{2})(\\w{2})(\\w{16})?(\\w{4})?(\\w{2})?$');
    var parsed = data.match(regularExpression);
    var out = {};
    if (parsed) {
      out.stickMac = parsed[1];
      out.unknow1 = parsed[2];
      out.online = parsed[3]=='01';
      if (out.online)
      {
        out.networkID = parsed[4];
        out.circleplusMac = '00' + out.networkID.substring(2);
        out.shortNetworkID = parsed[5];
        out.unknow2 = parsed[6];
      }
    }
    Logger.log("InsideParser - INITIALISE_RESPONSE: " + JSON.stringify(out), LogType.DEBUG);
    return out
  }},
  POWER_INFORMATION_REQUEST:{value:'0012', format: function(device,data) {
    return device.getMac();
  }},
  POWER_INFORMATION_RESPONSE:{value:'0013', regEx:'(\\w{16})(\\w{4})(\\w{4})(\\w{8})(\\w{8})(\\w{4})',
  parser:function(data) {
    var regularExpression = new RegExp('^(\\w{16})(\\w{4})(\\w{4})(\\w{8})(\\w{8})(\\w{4})$');
    var parsed = data.match(regularExpression);
    var out = {};
    /*if (data[3] === 'FFFF') {
        return {error: true, message: 'Got unknown pulse value "FFFF". Too much?'};
    }*/
    if (parsed) {
      out.mac = parsed[1];
      out.pulsesOneSecond = parseInt(parsed[2], 16);
      out.pulsesEightSeconds = parseInt(parsed[3], 16);
      out.pulsesConsoHour = parseInt(parsed[4], 16);
      out.pulsesProdHour = parseInt(parsed[5], 16);
      out.unknow = parsed[6];
    }
    Logger.log("InsideParser - POWER_INFORMATION_RESPONSE: " + JSON.stringify(out), LogType.DEBUG);
    return out
  }},
  CLOCK_SET_REQUEST:{value:'0016', format: function(device,data) {
    return device.getMac() + (new Date().toPlugwiseHex());
  }},
  POWER_CHANGE_REQUEST:{value:'0017', format: function(device,data) {
    return device.getMac()+data.toString(16).pad(2).toUpperCase();
  }},
  DEVICE_ROLECALL_REQUEST:{value:'0018', format: function(device,data) {
    return device.getCirclePlus().getMac()+data.toString(16).pad(2).toUpperCase();
  }},
  DEVICE_ROLECALL_RESPONSE:{value:'0019', regEx:'(\\w{16})(\\w{16})(\\w{2})',
  parser:function(data) {
    var regularExpression = new RegExp('^(\\w{16})(\\w{16})(\\w{2})$');
    var parsed = data.match(regularExpression);
    var out = {};
    if (parsed) {
      out.circleplusMac = parsed[1];
      out.deviceMac = parsed[2];
      out.nodeID = parsed[3];
    }
    Logger.log("InsideParser - DEVICE_ROLECALL_RESPONSE: " + JSON.stringify(out), LogType.DEBUG);
    return out
  }},
  WAKEUP_ANNONCE_RESPONSE:{value:'004F', regEx:'(\\w{16})(\\w{2})',
  parser:function(data) {
    var regularExpression = new RegExp('^(\\w{16})(\\w{2})$');
    var parsed = data.match(regularExpression);
    var out = {};
    if (parsed) {
      out.mac = parsed[1];
      out.annouceType = parsed[2];
    }
    Logger.log("InsideParser - WAKEUP_ANNONCE: " + JSON.stringify(out), LogType.DEBUG);
    return out
  }},
  SENSE_REPORT_RESPONSE:{value:'0105', regEx:'(\\w{16})(\\w{4})(\\w{4})',
  parser:function(data) {
    var regularExpression = new RegExp('^(\\w{16})(\\w{4})(\\w{4})$');
    var parsed = data.match(regularExpression);
    var out = {};
    if (parsed) {
      out.mac = parsed[1];
      out.humidity = 125.0 * (parseInt(parsed[2], 16) / 65536.0) - 6.0;
      out.temperature = 175.72 * (parseInt(parsed[3], 16) / 65536.0) - 46.85;
    }
    Logger.log("InsideParser - SENSE_REPORT_RESPONSE: " + JSON.stringify(out), LogType.DEBUG);
    return out
  }},
  SWITCH_REPORT_RESPONSE:{value:'0056', regEx:'(\\w{16})(\\w{2})(\\w{2})',
  parser:function(data) {
    var regularExpression = new RegExp('^(\\w{16})(\\w{2})(\\w{2})$');
    var parsed = data.match(regularExpression);
    var out = {};
    if (parsed) {
      out.mac = parsed[1];
      out.portMask = parseInt(parsed[2], 16);
      out.state = parseInt(parsed[3], 16)==1?1:0;
    }
    Logger.log("InsideParser - SWITCH_REPORT: " + JSON.stringify(out), LogType.DEBUG);
    return out
  }},
  REMOVE_NODE_REQUEST:{value:'001C', format: function(device,data) {
    return device.getMac()+data;
  }},
  REMOVE_NODE_REPLY:{value:'001D', regEx:'(\\w{16})(\\w{16})(\\w{2})',
  parser:function(data) {
    var regularExpression = new RegExp('^(\\w{16})(\\w{16})(\\w{2})$');
    var parsed = data.match(regularExpression);
    var out = {};
    if (parsed) {
      out.circleplusMac = parsed[1];
      out.deviceMac = parsed[2];
      out.status = parsed[3];
    }
    Logger.log("InsideParser - REMOVE_NODE_REPLY: " + JSON.stringify(out), LogType.DEBUG);
    return out
  }},
  DEVICE_INFORMATION_REQUEST:{value:'0023', format: function(device,data) {
    return data;
  }},
  DEVICE_INFORMATION_RESPONSE:{value:'0024', regEx:'(\\w{16})(\\w{2})(\\w{2})(\\w{4})(\\w{8})(\\w{2})(\\w{2})(\\w{12})(\\w{8})(\\w{2})',
  parser:function(data) {
    var regularExpression = new RegExp('^(\\w{16})(\\w{2})(\\w{2})(\\w{4})(\\w{8})(\\w{2})(\\w{2})(\\w{12})(\\w{8})(\\w{2})$');
    var parsed = data.match(regularExpression);
    var out = {};
    if (parsed) {
      out.mac = parsed[1];
      /*var minutes = parseInt(parsed[4], 16);
      var nbDays = minutes/(60*24) + 1;
      var nbHours = (minutes-nbDays*24*60)/60;
      var nbMinutes = minutes-nbDays*24*60-nbHours*60;
      out.date = new Date(parseInt(parsed[2], 16) + 2000,parseInt(parsed[3], 16),nbDay,nbHours, nbMinutes,0,0);*/
      out.date = (new Date(parseInt(parsed[2], 16) + 2000,parseInt(parsed[3], 16)-1,1)).addMinutes(parseInt(parsed[4], 16));
      out.logAdress = (parseInt(parsed[5], 16)-278528)/8; //var LOGADDR_OFFSET = 278528;
      out.powerState = parsed[6] == '01';
      out.hertz = parsed[7] == '85' ? '50':'60';
      out.hardwareVersion = parsed[8];
      out.firmwareVersion = parsed[9];
      out.type = PlugwiseDeviceType.getType(parseInt(parsed[10], 16));
    }
    Logger.log("InsideParser - DEVICE_INFORMATION_RESPONSE: " + JSON.stringify(out), LogType.DEBUG);
    return out
  }},
  DEVICE_CALIBRATION_REQUEST:{value:'0026', format: function(device,data) {
    return device.getMac();
  }},
  DEVICE_CALIBRATION_RESPONSE:{value:'0027',regEx:'(\\w{16})(\\w{8})(\\w{8})(\\w{8})(\\w{8})',
  parser:function(data) {
    var regularExpression = new RegExp('^(\\w{16})(\\w{8})(\\w{8})(\\w{8})(\\w{8})$');
    var parsed = data.match(regularExpression);
    var out = {};
    if (parsed) {
      out.mac = parsed[1];
      out.calibration = {};
      out.calibration.gainA = new Buffer(parsed[2], 'hex').readFloatBE(0);
      out.calibration.gainB = new Buffer(parsed[3], 'hex').readFloatBE(0);
      out.calibration.offTot = new Buffer(parsed[4], 'hex').readFloatBE(0);
      out.calibration.offNoise = new Buffer(parsed[5], 'hex').readFloatBE(0);
      out.calibration.date = new Date();
    }
    Logger.log("InsideParser - DEVICE_CALIBRATION_RESPONSE: " + JSON.stringify(out), LogType.DEBUG);
    return out
  }},
  REALTIMECLOCK_GET_REQUEST:{value:'0029', format: function(device,data) {
    return device.getMac();
  }},
  REALTIMECLOCK_GET_RESPONSE:{value:'003A', regEx:'(\\w{16})(\\w{2})(\\w{2})(\\w{2})(\\w{2})(\\w{2})(\\w{2})(\\w{2})',
  parser:function(data){
    Logger.log("InsideParser - REALTIMECLOCK_GET_RESPONSE: " + JSON.stringify(data), LogType.DEBUG);
    return {};
  }},
  CLOCK_GET_REQUEST:{value:'003E', format: function(device,data) {
    return device.getMac();
  }},
  CLOCK_GET_RESPONSE:{value:'003F', regEx:'(\\w{16})(\\w{2})(\\w{2})(\\w{2})(\\w{2})(\\w{2})(\\w{2})(\\w{2})',
  parser:function(data){
    // Mac,
    // hour = parseInt(data[2], 16);
    // minutes = parseInt(data[3], 16);
    // seconds = parseInt(data[4], 16);
    // weekday = parseInt(data[5], 16);
    Logger.log("InsideParser - REALTIMECLOCK_GET_RESPONSE: " + JSON.stringify(data), LogType.DEBUG);
    return {};
  }},

  POWER_BUFFER_REQUEST:{value:'0048', format: function(device,data) {
    return device.getMac() + data; //Should convert time in what way???
  }},
  POWER_BUFFER_RESPONSE:{value:'0049', regEx:'(\\w{16})(\\w{8})(\\w{8})(\\w{8})(\\w{8})(\\w{8})(\\w{8})(\\w{8})(\\w{8})(\\w{8})',
  parser:function(data){
    Logger.log("InsideParser - POWER_BUFFER_RESPONSE: " + JSON.stringify(data), LogType.DEBUG);
    return {};
  }},
  NODE_ADDED_TO_NETWORK:{value:'0061', regEx:'(\\w{16})', //sequence number is always FFFD
  parser:function(data) {
    var regularExpression = new RegExp('^(\\w{16})$');
    var parsed = data.match(regularExpression);
    var out = {};
    if (parsed) {
      out.mac = parsed[1];
    }
    Logger.log("InsideParser - NODE_ADDED_TO_NETWORK: " + JSON.stringify(out), LogType.DEBUG);
    return out
  }},
  HEADER:{value:'\u0005\u0005\u0003\u0003'},
  FOOTER:{value:'\r\n'}

  //other
  //004A + MAC of circle + / 0000
  //000C / 0010
  //0059 + MAC of circle+ / 0000
  //004E + MAC of circle + / 0000 0003 00F4 +Mac of circle + (check if cicle+ is connected?)

/*
Response
class PlugwiseClockInfoResponse(PlugwiseResponse):
    ID = b'003F'

    def __init__(self, seqnr = None):
        PlugwiseResponse.__init__(self, seqnr)
        self.time = Time()
        self.day_of_week = Int(0, 2)
        self.unknown = Int(0, 2)
        self.scheduleCRC = Int(0, 4)
        self.params += [self.time, self.day_of_week, self.unknown, self.scheduleCRC]

class PlugwisePowerBufferResponse(PlugwiseResponse):
    """returns information about historical power usage
    each response contains 4 log buffers and each log buffer contains data for 1 hour
    """
    ID = b'0049'

    def __init__(self, seqnr = None):
        PlugwiseResponse.__init__(self, seqnr)
        self.logdate1 = DateTime()
        self.pulses1 = SInt(0, 8)
        self.logdate2 = DateTime()
        self.pulses2 = SInt(0, 8)
        self.logdate3 = DateTime()
        self.pulses3 = SInt(0, 8)
        self.logdate4 = DateTime()
        self.pulses4 = SInt(0, 8)
        self.logaddr = LogAddr(0, length=8)
        self.params += [self.logdate1, self.pulses1, self.logdate2, self.pulses2,
            self.logdate3, self.pulses3, self.logdate4, self.pulses4, self.logaddr
        ]
class PlugwiseFeatureSetResponse(PlugwiseResponse):
    """returns feature set of modules
    """
    ID = b'0060'

    def __init__(self, seqnr = None):
        PlugwiseResponse.__init__(self, seqnr)
        self.features = Int(0, 16)
        self.params += [self.features]

class PlugwiseDateTimeInfoResponse(PlugwiseResponse):
    ID = b'003A'

    def __init__(self, seqnr = None):
        PlugwiseResponse.__init__(self, seqnr)
        self.time = TimeStr()
        self.day_of_week = Int(0, 2)
        self.date = DateStr()
        self.params += [self.time, self.day_of_week, self.date]

class PlugwiseSendScheduleResponse(PlugwiseResponse):
    ID = b'003D'

    def __init__(self, seqnr = None):
        PlugwiseResponse.__init__(self, seqnr)
        self.idx = Int(0, 2)
        self.params += [self.idx]

class PlugwisePingResponse(PlugwiseResponse):
    ID = b'000E'

    def __init__(self, seqnr = None):
        PlugwiseResponse.__init__(self, seqnr)
        self.qin = Int(0, 2)
        self.qout = Int(0, 2)
        self.pingtime = Int(0, 4)
        self.params += [self.qin, self.qout, self.pingtime]

class PlugwiseQueryCirclePlusResponse(PlugwiseResponse):
    ID = b'0002'

    def __init__(self, seqnr = None):
        PlugwiseResponse.__init__(self, seqnr)
        self.channel = String(None, length=2)
        self.source_mac_id = String(None, length=16)
        self.extended_pan_id = String(None, length=16)
        self.unique_network_id = String(None, length=16)
        self.new_node_mac_id = String(None, length=16)
        self.pan_id = String(None, length=4)
        self.idx = Int(0, length=2)
        self.params += [self.channel, self.source_mac_id, self.extended_pan_id, self.unique_network_id, self.new_node_mac_id, self.pan_id, self.idx]

    def __len__(self):
        arglen = sum(len(x) for x in self.params)
        return 18 + arglen

    def unserialize(self, response):
        PlugwiseResponse.unserialize(self, response)
        #Clear first two characters of mac ID, as they contain part of the short PAN-ID
        self.new_node_mac_id.value = b'00'+self.new_node_mac_id.value[2:]

class PlugwiseQueryCirclePlusEndResponse(PlugwiseResponse):
    ID = b'0003'

    def __init__(self, seqnr = None):
        PlugwiseResponse.__init__(self, seqnr)
        self.status = Int(0, 4)
        self.params += [self.status]

    def __len__(self):
        arglen = sum(len(x) for x in self.params)
        return 18 + arglen

class PlugwiseConnectCirclePlusResponse(PlugwiseResponse):
    ID = b'0005'

    def __init__(self, seqnr = None):
        PlugwiseResponse.__init__(self, seqnr)
        self.exsisting = Int(0, 2)
        self.allowed = Int(0, 2)
        self.params += [self.exsisting, self.allowed]

    def __len__(self):
        arglen = sum(len(x) for x in self.params)
        return 18 + arglen

class PlugwiseRemoveNodeResponse(PlugwiseResponse):
    ID = b'001D'

    def __init__(self, seqnr = None):
        PlugwiseResponse.__init__(self, seqnr)
        self.node_mac_id = String(None, length=16)
        self.status = Int(0, 2)
        self.params += [self.node_mac_id, self.status]

class PlugwiseClockSetRequest(PlugwiseRequest):
    ID = b'0016'

    def __init__(self, mac, dt):
        PlugwiseRequest.__init__(self, mac)
        passed_days = dt.day - 1
        month_minutes = (passed_days*24*60)+(dt.hour*60)+dt.minute
        d = DateTime(dt.year, dt.month, month_minutes)
        t = Time(dt.hour, dt.minute, dt.second)
        day_of_week = Int(dt.weekday(), 2)
        # FIXME: use LogAddr instead
        log_buf_addr = String('FFFFFFFF', 8)
        self.args += [d, log_buf_addr, t, day_of_week]

class PlugwiseLogIntervalRequest(PlugwiseRequest):
    ID = b'0057'

    def __init__(self, mac, usage, production):
        PlugwiseRequest.__init__(self, mac)
        self.args.append(Int(usage, length=4))
        self.args.append(Int(production, length=4))

class PlugwiseClearGroupMacRequest(PlugwiseRequest):
    ID = b'0058'

    def __init__(self, mac, taskId):
        PlugwiseRequest.__init__(self, mac)
        self.args.append(Int(taskId, length=2))

class PlugwiseFeatureSetRequest(PlugwiseRequest):
    ID = b'005F'

class PlugwiseDateTimeInfoRequest(PlugwiseRequest):
    ID = b'0029'

class PlugwiseSetDateTimeRequest(PlugwiseRequest):
    ID = b'0028'

    def __init__(self, mac, dt):
        PlugwiseRequest.__init__(self, mac)
        self.args.append(StringVal(dt.second, 2))
        self.args.append(StringVal(dt.minute, 2))
        self.args.append(StringVal(dt.hour, 2))
        self.args.append(StringVal(dt.weekday(), 2))
        self.args.append(StringVal(dt.day, 2))
        self.args.append(StringVal(dt.month, 2))
        self.args.append(StringVal((dt.year-PLUGWISE_EPOCH), 2))

class PlugwiseEnableScheduleRequest(PlugwiseRequest):
    """switches Schedule on or off"""
    ID = b'0040'

    def __init__(self, mac, on):
        PlugwiseRequest.__init__(self, mac)
        val = 1 if on == True else 0
        self.args.append(Int(val, length=2))
        #the second parameter is always 0x01
        self.args.append(Int(1, length=2))

class PlugwisePrepareScheduleRequest(PlugwiseRequest):
    """Send chunck of On/Off/StandbyKiller Schedule to Stick"""
    ID = b'003B'

    def __init__(self, idx, schedule_chunk):
        # PrepareScedule doesn't send MAC address
        PlugwiseRequest.__init__(self, '')
        self.args.append(Int(16*idx, length=4))
        for i in range(0,8):
            self.args.append(SInt(schedule_chunk[i], length=4))

class PlugwiseSendScheduleRequest(PlugwiseRequest):
    """Send chunk of  On/Off/StandbyKiller Schedule to Circle(+)"""
    ID = b'003C'

    def __init__(self, mac, idx):
        PlugwiseRequest.__init__(self, mac)
        self.args.append(Int(idx, length=2))

class PlugwiseSetScheduleValueRequest(PlugwiseRequest):
    """Send chunk of  On/Off/StandbyKiller Schedule to Circle(+)"""
    ID = b'0059'

    def __init__(self, mac, val):
        PlugwiseRequest.__init__(self, mac)
        self.args.append(SInt(val, length=4))

class PlugwisePingRequest(PlugwiseRequest):
    """Send ping to mac"""
    ID = b'000D'

    def __init__(self, mac):
        PlugwiseRequest.__init__(self, mac)

class PlugwiseEnableJoiningRequest(PlugwiseRequest):
    """Send a flag which enables or disables joining nodes (cirles) request"""
    ID = b'0008'

    def __init__(self, mac, on):
        PlugwiseRequest.__init__(self, mac)
        #TODO: Make sure that '01' means enable, and '00' disable joining
        val = 1 if on == True else 0
        self.args.append(Int(val, length=2))

class PlugwiseQueryCirclePlusRequest(PlugwiseRequest):
    """Query any presence off networks. Maybe intended to find a Circle+ from the Stick"""
    ID = b'0001'

    def __init__(self):
        """message for that initializes the Stick"""
        # init doesn't send MAC address
        PlugwiseRequest.__init__(self, '')

class PlugwiseConnectCirclePlusRequest(PlugwiseRequest):
    """Request connection to the network. Maybe intended to connect a Circle+ to the Stick"""
    ID = b'0004'

    def __init__(self, mac):
        PlugwiseRequest.__init__(self, mac)

    #This message has an exceptional format and therefore need to override the serialize method
    def serialize(self):
        """return message in a serialized format that can be sent out
        on wire
        """
        #This command has args: byte: key, byte: networkinfo.index, ulong: networkkey = 0
        args = b'00000000000000000000'
        msg = self.ID+sc(args)+self.mac
        checksum = self.calculate_checksum(msg)
        full_msg = self.PACKET_HEADER+msg+checksum+self.PACKET_FOOTER
        logcomm("SEND %4d ---> %4s           %s %16s %4s <---" % (len(full_msg), self.ID, sc(args), self.mac, checksum))
        return full_msg

class PlugwiseRemoveNodeRequest(PlugwiseRequest):
    """Send remove node from network request"""
    ID = b'001C'

    def __init__(self, mac, removemac):
        PlugwiseRequest.__init__(self, mac)
        self.args.append(String(removemac, length=16))

class PlugwiseResetRequest(PlugwiseRequest):
    """Send preset circle request"""
    ID = b'0009'

    def __init__(self, mac, moduletype, timeout):
        PlugwiseRequest.__init__(self, mac)
        self.args.append(Int(moduletype, length=2))
        self.args.append(Int(timeout, length=2))


        Case "00D9"
        				'* Reply-0008 01 reply (Mac-Circle+)
        				strMACsrc = Mid(strOption,9,16)
        				DecodeCommand = strCommand & " " & strSequence & " " & strValidate & " " & strMACsrc
        			Case "00DD"
        				'* Reply-0008 00 reply (Mac-Circle+)
        				strMACsrc = Mid(strOption,9,16)
        				DecodeCommand = strCommand & " " & strSequence & " " & strValidate & " " & strMACsrc



        Fin d'ajout de module ????
      SEND 0008 01
      RECV 0000 020F 00C1
      RECV 0000 020F 00D9 000D6F0000B1B64B

*/
}

String.prototype.pad = function (length,char,side){
  if (typeof(side) === 'undefined') side = 'LEFT';
  if (typeof(length) === 'undefined') return this;
  if (typeof(char) === 'undefined') char = '0';

  if (length-this.length < 0) return this;
  var paddingTxt = char.repeat(length-this.length);
  if (side.toUpperCase() == 'LEFT') return paddingTxt+this;
  else return this+paddingTxt;
}

Date.prototype.toPlugwiseHex = function () {
  var hexDate = ((this.getYear() + 1900 - 2000).toString(16)).pad(2,'0') +
    ((this.getMonth() + 1).toString(16)).pad(2,'0') +
    (((this.getDate()-1) * 24 * 60 + this.getHours() * 60 + this.getMinutes()).toString(16)).pad(4,'0');

  var tempLog = "FFFFFFFF";

  var hexTime = ((this.getHours()).toString(16)).pad(2,'0') +
    ((this.getMinutes()).toString(16)).pad(2,'0') +
    ((this.getSeconds()).toString(16)).pad(2,'0') +
    ((this.getDay()+1).toString(16)).pad(2,'0');

  return (hexDate+tempLog+hexTime).toUpperCase();
}


Date.prototype.addSeconds = function(seconds) {
  this.setSeconds(this.getSeconds() + seconds);
  return this;
};

Date.prototype.addMinutes = function(minutes) {
  this.setMinutes(this.getMinutes() + minutes);
  return this;
};

Date.prototype.addHours = function(hours) {
  this.setHours(this.getHours() + hours);
  return this;
};

Date.prototype.addDays = function(days) {
  this.setDate(this.getDate() + days);
  return this;
};

Date.prototype.addWeeks = function(weeks) {
  this.addDays(weeks*7);
  return this;
};

Date.prototype.addMonths = function (months) {
  var dt = this.getDate();

  this.setMonth(this.getMonth() + months);
  var currDt = this.getDate();

  if (dt !== currDt) {
    this.addDays(-currDt);
  }

  return this;
};

Date.prototype.addYears = function(years) {
  var dt = this.getDate();

  this.setFullYear(this.getFullYear() + years);

  var currDt = this.getDate();

  if (dt !== currDt) {
    this.addDays(-currDt);
  }

  return this;
};


class PlugwiseOutgoingMessage {
  constructor(sourcedevice,type,param,callback,overrideTimeout, overrideMaxTryCount){
    this._callback = callback;
    this._sourceDevice = sourcedevice;
    this._messageType = type;
    this._param = param;
    this._tryCount = 0;
    this._returnStatus = 'NoResponse';
    if (overrideTimeout) this._timeout = overrideTimeout;
    else if (type.timeout) this._timeout = type.timeout;
    else this._timeout = TIMEOUT;
    if (overrideMaxTryCount) this._maxTryCount = overrideMaxTryCount;
    else if (type.maxTryCount) this._maxTryCount = type.maxTryCount;
    else this._maxTryCount = MAXTRYCOUNT;
  }

  getCallback(){
    return this._callback;
  }

  getReturnStatus(){
    return this._returnStatus;
  }

  getDevice(){
    return this._sourceDevice;
  }

  updateTryCount()
  {
    this._tryCount++;
  }

  updateReturnStatus(newStatus)
  {
    this._returnStatus = newStatus;
  }

  getTryCount()
  {
    return this._tryCount;
  }

  getMaxTryCount()
  {
    
    return this._maxTryCount;
  }

  getMsgTimeout()
  {
    return this._timeout;
  }

  setMaxTryCount(value)
  {
    this._maxTryCount = value;
  }

  output()
  {
    var message = this._messageType.value + this._messageType.format(this._sourceDevice, this._param);
    return PlugwiseMessageConst.HEADER.value + message + crc.crc16xmodem(message).toString(16).toUpperCase().pad(4) + PlugwiseMessageConst.FOOTER.value;
  }

  toString(){
    return "date d'envoi : " + this.dateEmitted + ", date acceptation : " + this.dateAccepted + ", source : " + this._sourceDevice.getMac() + ", nbreEssai : " + this.getTryCount() + ", output : " + this.output();
  }
}

class PlugwiseIncomingMessage {
  constructor(data){
    this._originalMessage = data;
    var parsed = PlugwiseMessageConst.parser(data);
    this._type = parsed.type;
    this._sequence = parsed.sequence;
    this._header = parsed.header;
    this._crc = parsed.crc;
    this._error = 'no error';
    var foundType = false;

    if (!this.hasValidHeader())
    {
      this._error = 'Le header du message '+data+' n\'est pas valide. Contacter le developpeur.';
      return;
    }

    if (!this.hasValidCRC(parsed.type+parsed.sequence+parsed.data))
    {
      this._error = 'Le CRC ' + this._crc + ' du message '+ parsed.type+parsed.sequence+parsed.data +' (message complet : ' + data + ') n\'est pas valide. Contacter le developpeur.';
      return;
    }

    for(var key in PlugwiseMessageConst) {
      if (PlugwiseMessageConst[key].value == parsed.type) {
        foundType = true;
        if (typeof (PlugwiseMessageConst[key].parser) !== 'undefined')
          this._data = PlugwiseMessageConst[key].parser(parsed.data);
        else {
          this._error = 'Pas de "parser" défini pour le message ' + PlugwiseMessageConst[key].value + '. Contacter le developpeur.';
        }
      }
    }

    if (!foundType) this._error = 'Le type '+parsed.type+' n\'est pas défini. Contacter le developpeur.';
  }

  hasValidHeader()
  {
    return this._header == PlugwiseMessageConst.HEADER.value;
  }

  hasValidCRC(command)
  {
    return this._crc == crc.crc16xmodem(command).toString(16).toUpperCase().pad(4);
  }

  get Type()
  {
    return this._type;
  }

  get SubType()
  {
    return this._type;
  }

  get Data()
  {
    return this._data;
  }

  get Sequence()
  {
    return this._sequence;
  }

  get OriginalData()
  {
    return this._originalMessage;
  }

  hasError()
  {
    return !(this._error == 'no error');
  }

  getError()
  {
    return this._error;
  }
}

exports.PlugwiseIncomingMessage = PlugwiseIncomingMessage;
exports.PlugwiseOutgoingMessage = PlugwiseOutgoingMessage;
exports.PlugwiseMessageConst = PlugwiseMessageConst;
exports.PlugwiseDeviceType = PlugwiseDeviceType;
