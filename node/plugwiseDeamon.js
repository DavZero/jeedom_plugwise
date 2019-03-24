var net = require('net');
var LogType = require('./logger/logger.js').logType;
var Logger = require('./logger/logger.js').getInstance();
var plugwiseAPI = require ('./plugwisejs/plugwiseDevice.js');
var request = require('request');

Logger.setLogLevel(LogType.DEBUG);

/******* Utility *****************/
var urlJeedom = '';
var gwAddress = '';
var logLevel = 'error';
var serverPort=5001;

// print process.argv
process.argv.forEach(function(val, index, array) {
  switch ( index ) {
    case 2 : urlJeedom = val; break;
		case 3 : gwAddress = val; break;
    case 4 : serverPort = val; break;
    case 5 :
      logLevel = val;
      if (logLevel == 'debug') Logger.setLogLevel(LogType.DEBUG);
      else if (logLevel == 'info') Logger.setLogLevel(LogType.INFO);
      else if (logLevel == 'warning') Logger.setLogLevel(LogType.WARNING);
      else Logger.setLogLevel(LogType.ERROR);
      break;
  }
});

Logger.log("Démon version 1.1.24", LogType.INFO);
Logger.log("urlJeedom = "+urlJeedom, LogType.DEBUG) ;
Logger.log("gateway = "+gwAddress, LogType.DEBUG) ;
Logger.log("serverPort = "+serverPort, LogType.DEBUG) ;
Logger.log("logLevel = "+logLevel, LogType.INFO) ;

var busy = false;
var jeedomSendQueue = [];

var processJeedomSendQueue = function()
{
  //Logger.log('Nombre de messages en attente de traitement : ' + jeedomSendQueue.length, LogType.DEBUG);
  var nextMessage = jeedomSendQueue.shift();

  if (!nextMessage) {
      busy = false;
      return;
  }
  Logger.log('Traitement du message : ' + JSON.stringify(nextMessage), LogType.DEBUG);
  request({url:nextMessage.url, qs:nextMessage.data}, function(err, response, body) {
    if(err)
    {
      Logger.log(err, LogType.WARNING);
      if (nextMessage.tryCount < 5)
      {
        nextMessage.tryCount++;
        jeedomSendQueue.unshift(nextMessage);
      }
    }
    else Logger.log("Response from Jeedom: " + response.statusCode, LogType.DEBUG);
    processJeedomSendQueue();
  });
}

var sendToJeedom = function(data, callback)
{
  data.type = 'plugwise';
  var message = {};
  message.url = urlJeedom;
  message.data = data;
  message.tryCount = 0;
  //Logger.log("Ajout du message " + JSON.stringify(message) + " dans la queue des messages a transmettre a Jeedom", LogType.DEBUG);
  jeedomSendQueue.push(message);
  if (busy) return;
  busy = true;
  processJeedomSendQueue();
}

//Test d'envoi vers jeedomError
/*sendToJeedom({eventType: 'updateInfo', firmwareVersion : 'toto',
 state :'On', frequency : 50, mac: 'ZZZZZZZZZZZZZZ', eqpType: 'Circle'});

 var i = 1;

 var interval = setInterval(() => {
   sendToJeedom({eventType: 'updatePowerInfo', power : 1, power8s : 1, consumptionThisHour: i++, mac: 'ZZZZZZZZZZZZZZ'});
 },30000);

setTimeout(() => {
  clearInterval(interval);
},6000000);*/

// sendToJeedom({eventType: 'updateInfo', firmwareVersion : 'ZZZ', hardwareVersion : 'YYY', mac: 'XXXXXXXXXXXXX', eqpType: 'Stick'});

// sendToJeedom({eventType: 'updateInfo', firmwareVersion : 'ZZZ', mac: 'YYYYYYYYYYYYYYY', eqpType: 'CirclePlus'});
//setTimeout(() => {sendToJeedom({eventType: 'changeState', state : 'Off', mac: '000D6F0000D3595D'})},0000) ;
/*setTimeout(() => {sendToJeedom({eventType: 'changeState', state : 'On', mac: '000D6F0000D3595D'})},1000) ;
setTimeout(() => {sendToJeedom({eventType: 'changeState', state : 'Off', mac: '000D6F0000D3595D'})},1000) ;*/

//Test de class
//var crc = require('crc');
//test = crc.crc16xmodem('00240707000D6F00002367151004973C0005F9C801850000047300074E0843A901').toString(16).toUpperCase();
//Logger.log("Test de crc : " + test.pad(4), LogType.INFO);

/*var test = require('./plugwisejs/testdvt.js')
var test2 = require('./plugwisejs/plugwiseMessage.js')

var testd = new test.testParent("parent");
//var testMess = new test2.PlugwiseIncomingMessage('�00240707000D6F00002367151004973C0005F9C801850000047300074E0843A9010568');

//Logger.log("MessageTest: " + JSON.stringify(testMess), LogType.DEBUG);

/**/

//Initiliastion de plugwisejs
Logger.log("Initialisation de la clé plugwise : " + gwAddress, LogType.INFO);
var plugwiseStick = new plugwiseAPI.PlugwiseStick(gwAddress);

plugwiseStick.on('plugwiseError', function(err) {
  sendToJeedom({eventType: 'error', description : err});
});

plugwiseStick.on('stickUpdateInfo', function(device) {
  sendToJeedom({eventType: 'updateInfo', firmwareVersion : device.getFirmwareVersion(), hardwareVersion : device.getHardwareVersion(),
  mac: device.getMac(), eqpType: device.getType().name});
});

plugwiseStick.on('circleUpdateInfo', function(device) {
  sendToJeedom({eventType: 'updateInfo', firmwareVersion : device.getFirmwareVersion(), hardwareVersion : device.getHardwareVersion(),
   state : device.isOn()?'On':'Off', frequency : device.getFrequency(), mac: device.getMac(), eqpType: device.getType().name});
});

plugwiseStick.on('circleUpdatePowerInfo', function(device) {
  sendToJeedom({eventType: 'updatePowerInfo', power : device.getInstantPower1s(), power8s : device.getInstantPower8s(), consumptionThisHour: device.getConsumptionThisHour(), mac: device.getMac()});
});

plugwiseStick.on('circleChangeState', function(device) {
  sendToJeedom({eventType: 'changeState', state : (device.isOn()?'On':'Off'), mac: device.getMac()});
});

plugwiseStick.on('circleRemove', function(macAddress) {
  sendToJeedom({eventType: 'removeEquipment', mac: macAddress});
});

plugwiseStick.on('senseUpdateInfo', function(device) {
  sendToJeedom({eventType: 'updateInfo', firmwareVersion : device.getFirmwareVersion(), hardwareVersion : device.getHardwareVersion(),
  mac: device.getMac(), eqpType: device.getType().name});
});

plugwiseStick.on('senseUpdateSenseInfo', function(device) {
  sendToJeedom({eventType: 'senseValue', humidity: device.getHumidity(), temperature: device.getTemperature(), mac: device.getMac()});
});

//Serveur pour la reception des message depuis jeedom
Logger.log("Création du serveur sur le port "+serverPort, LogType.DEBUG);
//Create server for manage Jeedom->plugwisejs
var server = net.createServer(function(c) {
  Logger.log("Server connected", LogType.DEBUG);

  c.on('error', function(e) {
    Logger.log("Error server disconnected, err : " + e, LogType.ERROR);
  });

  c.on('close', function() {
    Logger.log("Server disconnected", LogType.DEBUG);
  });

  c.on('data', function(data) {
    Logger.log("Data receive from Jeedom: " + data, LogType.DEBUG);
    sendToPlugwise(data);
  });
});

server.listen({host: 'localhost',port: serverPort}, function(e) {
  Logger.log("Server bound on " + serverPort, LogType.INFO);
});

var sendToPlugwise = function (payload){
  var data = JSON.parse(payload);
  if (data.macAddress == 'STICK'){
    switch (data.command){
      case 'TOGGLEINCLUDESTATE':
        Logger.log("Changement du mode d'inclusion");
        plugwiseStick.toggleIncludeState();
        break;
      case 'SETINCLUDESTATE':
        Logger.log("Changement du mode d'inclusion " + data.parameter);
        plugwiseStick.setIncludeState(data.parameter);
        /*sendToJeedom({eventType: 'updateInfo', firmwareVersion : 'toto',
         state :'On', frequency : 50, mac: 'UUUUUUUUUUUU', eqpType: 'Circle'});*/
        break;
      case 'REMOVEEQP':
        Logger.log("Suppression de l'equipement " + data.parameter);
        plugwiseStick.removeCircle(data.parameter);
        /*sendToJeedom({eventType: 'removeEquipment', mac: data.parameter});*/
        break;
      case 'SYNCHRONIZE':
        Logger.log("Synchronisation des equipements");
        plugwiseStick.synchronize();
        break;
      case 'REPAIRNETWORK':
        Logger.log("Réparation du reseau");
        plugwiseStick.repairNetwork();
        break;
    }
    return;
  }
  obj = plugwiseStick.findDeviceByMac(data.macAddress)
  if (obj == null) {
    Logger.log("Impossible de trouver le device " + data.macAddress + " sur le reseau plugwise", LogType.ERROR);
    return;
  }
  switch (data.command){
    case 'SWITCHON':
      Logger.log("Ordre PowerOn sur prise " + data.macAddress + " envoyé", LogType.INFO);
      obj.powerOn();
      break;
    case 'SWITCHOFF':
      Logger.log("Ordre PowerOff sur prise " + data.macAddress + " envoyé", LogType.INFO);
      obj.powerOff();
      break;
    case 'INFO':
      Logger.log("Ordre UpdateInfo sur device " + data.macAddress + " envoyé", LogType.INFO);
      device.updateInformation();
      break;
    case 'CALIBRATION':
      Logger.log("Ordre UpdateCalibration sur prise " + data.macAddress + " envoyé", LogType.INFO);
      obj.calibration();
      break;
    case 'POWERINFO':
      Logger.log("Ordre UpdatePowerInfo sur prise " + data.macAddress + " envoyé", LogType.INFO);
      obj.updatePowerInfo();
      break;
    default:
      break;
  }
}

process.on('uncaughtException', function ( err ) {
	console.error('An uncaughtException was found, the program will end : ' + err);
  //console.error('An uncaughtException was found, the program will end : ' + err.stack);
  Logger.log('An uncaughtException was found, the program will end : ' + err,LogType.ERROR);
  //sendToJeedom({eventType: 'error', description : err.message},() => {
  //
  //});
  server.close();
  plugwiseStick.shutDown();
  Logger.log("Daemon is shutdown", LogType.INFO);
  throw err;
});
/**/
