"use strict";

var LogType = require('../logger/logger.js').logType;
var Logger = require('../logger/logger.js').getInstance();
var PlugwiseIncomingMessage = require('./plugwiseMessage.js').PlugwiseIncomingMessage;
var PlugwiseOutgoingMessage = require('./plugwiseMessage.js').PlugwiseOutgoingMessage;
var PlugwiseMessageConst = require('./plugwiseMessage.js').PlugwiseMessageConst;
var PlugwiseDeviceType = require('./plugwiseMessage.js').PlugwiseDeviceType;
var EventEmitter = require('events');
var SerialPort = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline')

var PULSE_FACTOR = 2.1324759;
var POWER_INTERVAL = 30000;
var INVALID_WATT_THRESHOLD = 10000;

var customRound = function (value, n) {
  return Math.round(value * Math.pow(10, n)) / Math.pow(10, n);
}

class PlugwiseDevice extends EventEmitter {
  constructor(mac) {
    super();
    Logger.log("Création de l'equipement " + this.getType().name + " avec adresse MAC : " + mac);
    this._mac = mac;
  }

  getType() {
    return PlugwiseDeviceType.UNDEFINDED;
  }

  getMac() {
    return this._mac;
  }

  getFirmwareVersion() {
    return this._firmwareVersion;
  }

  getHardwareVersion() {
    return this._hardwareVersion;
  }
}

class PlugwiseSense extends PlugwiseDevice {
  constructor(deviceData, plugwiseStick) {
    super(deviceData.mac);
    this._stick = plugwiseStick;
    this._updateInformation(deviceData);
    Logger.log("Initialisation de l'equipement " + this.getType().name + " avec adresse MAC : " + this._mac + " terminée avec succès.");
  }

  getType() {
    return PlugwiseDeviceType.SENSE;
  }

  updateInformation() {
    //this._stick.updateDeviceInformation();
    //Nothing to do on a battery device
  }

  _updateInformation(data) {
    this._firmwareVersion = data.firmwareVersion;
    this._hardwareVersion = data.hardwareVersion;
    this._date = data.date;
    this._stick.emit('senseUpdateInfo', this);
  }

  _updateSenseInfo(data) {
    this._humidity = customRound(data.humidity, 2);
    this._temperature = customRound(data.temperature, 2);
    this._stick.emit('senseUpdateSenseInfo', this);
  }

  getHumidity() {
    return this._humidity;
  }

  getTemperature() {
    return this._temperature;
  }
}

class PlugwiseStick extends PlugwiseDevice {

  constructor(port) {
    super('');
    this._serialPort = port;
    this._initialized = false;
    this._opened = false;
    this._sendQueue = [];
    this._acknowledgedQueue = {};
    this._acknowledgedQueue.Count = 0;
    this._currentMessage = {};
    this._inclusionMode = false;

    //var parser = new SerialPort.parsers.Readline({delimiter: '\n'});
    var parser = new ReadlineParser({ delimiter: '\n' });
    parser.on('data', this.processData.bind(this));

    // connect to the serial port of the 'stick'
    this._sp = new SerialPort({ path: port, baudRate: 115200 });

    this._sp.pipe(parser);

    this._sp.on('open', () => {
      this._opened = true;
      this.init(() => {
        //Log initialisation completed
        Logger.log("Initilaisation de l'equipement " + this.getType().name + " avec adresse MAC : " + this._mac + " terminée avec succès.");
        //this.processMessageQueue();
      });
    });
  }

  _updateInformation(data) {
    this._firmwareVersion = data.firmwareVersion;
    this._hardwareVersion = data.hardwareVersion;
    this.emit('stickUpdateInfo', this);
  }

  updateInformation(callback) {
    this.sendMessage(new PlugwiseOutgoingMessage(this, PlugwiseMessageConst.DEVICE_INFORMATION_REQUEST, this.getMac(), (device, messageData) => {
      device._updateInformation(messageData);
      if (callback) callback();
    }));
  }

  toggleIncludeState() {
    this.setIncludeMode(this._inclusionMode ? 0 : 1);
  }

  setIncludeState(newState) {
    this._inclusionMode = (newState == 1);
    //Testing 0008 message mais sans resultat
    this.sendMessage(new PlugwiseOutgoingMessage(this, PlugwiseMessageConst.ENABLEJOINING_REQUEST, newState, (device, messageData) => {
      Logger.log("Mode d'inclusion " + (this._inclusionMode ? "activé" : "désactivé"), LogType.DEBUG);
    }));
  }

  shutDown() {
    if (this._sp.isOpen) this._sp.close();
  }

  findDeviceByMac(mac) {
    if (this._deviceList[mac]) return this._deviceList[mac];
    //else this.emit('plugwiseError','L\'equipement ayant l\'adresse mac ' + mac + ' n\'existe pas');
    return null;
  }

  processData(data) {
    try {
      Logger.log("Message reçu brut : " + data, LogType.DEBUG);
      if (data.substring(0, 1) == '#' || (data.substring(0, 9) == '000D6F000')) {
        Logger.log("Message igonré : " + data, LogType.DEBUG);
        return;
      }
      var message = new PlugwiseIncomingMessage(data);
      if (message.hasError()) {
        Logger.log(message.getError(), LogType.ERROR);
        this.emit('plugwiseError', message.getError());
        return;
      }
      //Logger.log("Analyse du code : " + message.Type, LogType.DEBUG);
      switch (message.Type) {
        case PlugwiseMessageConst.ACKNOWLEDGEMENT_V1.value:
        case PlugwiseMessageConst.ACKNOWLEDGEMENT_V2.value:
          //Logger.log("Analyse du sous-code : " + message.Data.subtype, LogType.DEBUG);
          var acknowledgementMessageConst = PlugwiseMessageConst.ACKNOWLEDGEMENT_SUBTYPE;
          switch (message.Data.subtype) {
            case acknowledgementMessageConst.SUCCESS.value:
              if (!this._currentMessage) {
                Logger.log('Message de confirmation de reception de message non attendu ' + data, LogType.WARNING);
              }
              else {
                this._currentMessage.sequence = message.Sequence;
                this._currentMessage.dateAccepted = new Date();
                if (this._currentMessage.getCallback()) {
                  this._acknowledgedQueue[message.Sequence] = this._currentMessage;
                  this._acknowledgedQueue.Count++;
                  //On fait une vérification que le message a bien recu une réponse
                  this._acknowledgedQueue[message.Sequence].timeoutFunction = setTimeout((id) => {
                    if (this._acknowledgedQueue[id]) {
                      Logger.log('Le message ' + this._acknowledgedQueue[id].output() + ' n\'a pas recu de réponse, on tente de le retransmettre', LogType.WARNING);
                      this.resendMessage(this._acknowledgedQueue[id]);
                      this._acknowledgedQueue.Count--;
                      delete this._acknowledgedQueue[id];
                    }
                  }, this._acknowledgedQueue[message.Sequence].getMsgTimeout(), message.Sequence);
                }
                delete this._currentMessage;
                this.processMessageQueue();
              }
              break;
            case acknowledgementMessageConst.ON.value:
              //Extraction de la liste des messages en attente de réponse
              Logger.log('******************Message en attente de réponse**********************', LogType.DEBUG);
              for (var key in this._acknowledgedQueue) {
                Logger.log(this._acknowledgedQueue[key].toString(), LogType.DEBUG);
              }
              Logger.log('******************Fin des messages en attente de réponse**********************', LogType.DEBUG);
              if (!this.processResponse(message)) {
                //On vérifie que l'equipement existe bien sinon on le créer
                var device = this.findDeviceByMac(message.Data.mac);
                if (device) device._updateState(true);
                else this._addDevice(message.Data.mac, (createdDevice) => {
                  createdDevice._updateState(true);
                });
              }
              break;
            case acknowledgementMessageConst.OFF.value:
              if (!this.processResponse(message)) {
                //On vérifie que l'equipement existe bien sinon on le créer
                var device = this.findDeviceByMac(message.Data.mac);
                if (device) device._updateState(false);
                else this._addDevice(message.Data.mac, (createdDevice) => {
                  createdDevice._updateState(false);
                });
              }
            case acknowledgementMessageConst.CLOCKSET.value:
              this.processResponse(message);
              break;
            case acknowledgementMessageConst.ENABLEJOINING.value:
            case acknowledgementMessageConst.DISABLEJOINING.value:
              this.processResponse(message);
              break;
            case acknowledgementMessageConst.ERROR.value:
              if (!this._currentMessage) {
                Logger.log('Message d\'avertissement de formattage incorrect sans message envoyé ' + data, LogType.WARNING);
              }
              else {
                Logger.log('L\'envoi du message ' + this._currentMessage.output() + ' ne s\'est pas executé correctement, code retour ' + message.Data.subtype + '. Ressayer et contacter le developpeur si c\'est régulier', LogType.ERROR);
                this.emit('plugwiseError', 'L\'envoi du message ' + this._currentMessage.output() + ' ne s\'est pas executé correctement, code retour ' + message.Data.subtype + '. Ressayer et contacter le developpeur si c\'est régulier');
                delete this._currentMessage;
                this.processMessageQueue();
              }
              break;
            case acknowledgementMessageConst.TIMEOUT.value:
              var messageInError = this._currentMessage;
              if (this._acknowledgedQueue[message.Sequence]) {
                clearTimeout(this._acknowledgedQueue[message.Sequence].timeoutFunction);
                messageInError = this._acknowledgedQueue[message.Sequence];
                delete this._acknowledgedQueue[message.Sequence];
                this._acknowledgedQueue.Count--;
              }

              if (messageInError) {
                messageInError.updateReturnStatus(message.Data.subtype);
                this.resendMessage(messageInError);
              }
              else {
                Logger.log('Message de tiemout recu sans message envoyé ' + data, LogType.WARNING);
              }
              break;
            default:
              Logger.log('Le sous code de retour ' + message.Data.subtype + ' n\'est pas géré : ' + data + '. Contacter le developpeur', LogType.WARNING);
              break;
          }
          break;
        case PlugwiseMessageConst.NODE_AVAILABLE.value:
          Logger.log('Réception demande d\'intégration au reseau de la prise :' + message.Data.mac, LogType.INFO);
          if (this._inclusionMode) {
            Logger.log('Demande acceptée', LogType.INFO);
            this.sendMessage(new PlugwiseOutgoingMessage(this, PlugwiseMessageConst.NEW_NODE_ACCEPTED_REQUEST, '01' + message.Data.mac));
            Logger.log('Intégration de la prise ' + message.Data.mac + 'dans le reseau prise en compte', LogType.INFO);
          }
          else {
            Logger.log('Demande refusée', LogType.INFO);
            this.sendMessage(new PlugwiseOutgoingMessage(this, PlugwiseMessageConst.NEW_NODE_ACCEPTED_REQUEST, '00' + message.Data.mac));
          }
          break;
        case PlugwiseMessageConst.NODE_ADDED_TO_NETWORK.value:
          if (message.Data.mac != this.getMac()) this._addDevice(message.Data.mac);
          break;
        case PlugwiseMessageConst.REMOVE_NODE_REPLY.value:
          if (!this.processResponse(message)) {
            Logger.log('Réception d\'une suppression d\'une prise sans l\'avoir demandé', LogType.WARNING);
          }
          break;
        case PlugwiseMessageConst.INITIALISE_RESPONSE.value:
          if (!this.processResponse(message)) {
            Logger.log('Réception d\'un retour d\'initialisation sans l\'avoir demandé', LogType.INFO);
          }
          break;
        case PlugwiseMessageConst.POWER_INFORMATION_RESPONSE.value:
          if (!this.processResponse(message)) {
            //On vérifie que l'equipement existe bien sinon on le créer
            var device = this.findDeviceByMac(message.Data.mac);
            if (device) device._updatePowerInfo(message.Data);
            else this._addDevice(message.Data.mac, (createdDevice) => {
              createdDevice._updatePowerInfo(message.Data);
            });
          }
          break;
        case PlugwiseMessageConst.DEVICE_ROLECALL_RESPONSE.value:
          if (!this.processResponse(message)) {
            this._addDevice(message.Data.deviceMac);
          }
          break;
        case PlugwiseMessageConst.DEVICE_INFORMATION_RESPONSE.value:
          if (!this.processResponse(message)) {
            this._updateDeviceInformation(message.Data);
          }
          break;
        case PlugwiseMessageConst.DEVICE_CALIBRATION_RESPONSE.value:
          if (!this.processResponse(message)) {
            //On vérifie que l'equipement existe bien sinon on le créer
            var device = this.findDeviceByMac(message.Data.mac);
            if (device) device._updateCalibration(message.Data);
            else this._addDevice(message.Data.mac, (createdDevice) => {
              createdDevice._updateCalibration(message.Data);
            });
          }
          break;
        case PlugwiseMessageConst.WAKEUP_ANNONCE_RESPONSE.value:
          var device = this.findDeviceByMac(message.Data.mac);
          if (!device) this._addDevice(message.Data.mac);
          break;
        case PlugwiseMessageConst.REALTIMECLOCK_GET_RESPONSE.value:
          this.processResponse(message);
          break;
        case PlugwiseMessageConst.CLOCK_GET_RESPONSE.value:
          this.processResponse(message);
          break;
        case PlugwiseMessageConst.SENSE_REPORT_RESPONSE.value:
          var device = this.findDeviceByMac(message.Data.mac);
          if (device) device._updateSenseInfo(message.Data);
          else this._addDevice(message.Data.mac, (createdDevice) => {
            createdDevice._updateSenseInfo(message.Data);
          });
          break;
        default:
          Logger.log('Le code de retour ' + message.Type + ' n\'est pas géré : ' + data + '. Contacter le developpeur', LogType.WARNING);
          break;
      }
    } catch (e) {
      Logger.log("Erreur lors du traitement du message : " + data + ', err : ' + e, LogType.ERROR);
    }
  }

  getType() {
    return PlugwiseDeviceType.STICK;
  }

  init(callback) {
    this._deviceList = {};
    this.sendInitMessage(new PlugwiseOutgoingMessage(this, PlugwiseMessageConst.INITIALISE_REQUEST, '', (stick, messageData) => {
      stick._initialized = true;
      stick._mac = messageData.stickMac;
      stick.updateInformation();
      if (messageData.online) {
        stick.sendMessage(new PlugwiseOutgoingMessage(stick, PlugwiseMessageConst.DEVICE_INFORMATION_REQUEST, messageData.circleplusMac, (stick, messageData) => {
          var device = stick._updateDeviceInformation(messageData);
          stick._searchDevices();
        }, 10000, 16));
      }
      else {
        //ToDo, Manage pairing of Circle+
        // SEND 0001 / receive 0000 + seqID / receive 0002 and 0003 with same seqID
        // SEND 000A  / receive 0000 + seqID / receive 0011 with same seqID
        // SEND 0004 0000 0000000000000000 CIRCLEMAC FROM 0002 / receive 0000 + seqID / receive 0005 and 0003 with same seqID
        // SEND 000A  / receive 0000 + seqID / receive 0011 with same seqID
        // SEND 0023 CIRCLE+MAC
        Logger.log('L\'association entre le stick et la prise CirclePlus n\'est pas effective. L\'implémentation de la connection entre les deux n\'est pas encore opérationnel, vous devez le faire sur le logiciel source', LogType.ERROR);
      }
      if (callback) callback();
    }));
  }

  repairNetwork() {
    this._deviceList = {};
    this.sendMessage(new PlugwiseOutgoingMessage(this, PlugwiseMessageConst.ENABLEJOINING_REQUEST, 0, (stick, messageData) => {
      stick.updateInformation(() => {
        stick._addDevice(messageData.mac, () => {
          stick.sendMessage(new PlugwiseOutgoingMessage(stick.getCirclePlus(), PlugwiseMessageConst.REALTIMECLOCK_GET_REQUEST, '', (device, messageData) => {
            stick.sendMessage(new PlugwiseOutgoingMessage(stick.getCirclePlus(), PlugwiseMessageConst.CLOCK_GET_REQUEST, '', (device, messageData) => {
              device.updatePowerInfo(() => {
                device.updateInformation(() => {
                  stick._searchDevices();
                });
              });
            }));
          }));
        });
      });
    }));
  }

  sendInitMessage(message) {
    Logger.log("Ajout dans la queue du message : " + message.output(), LogType.DEBUG);
    this._sendQueue.push(message);
    this._busy = true;
    this.processMessageQueue();
  }

  sendMessage(message) {
    Logger.log("Ajout dans la queue du message : " + message.output(), LogType.DEBUG);
    this._sendQueue.push(message);
    if (this._busy || !this._opened || !this._initialized) return;
    this._busy = true;
    this.processMessageQueue();
  }

  resendMessage(message) {
    if (message.getTryCount() <= message.getMaxTryCount()) {
      Logger.log('L\'envoi du message ' + message.output() + ' ne s\'est pas executé correctement, code retour ' + message.getReturnStatus() + '. Tentative de renvoi numéro ' + message.getTryCount(), LogType.WARNING);
      this._sendQueue.unshift(message);
      if (this._busy || !this._opened || !this._initialized) return;
      this._busy = true;
      this.processMessageQueue();
    }
    else {
      Logger.log('L\'envoi du message ' + message.output() + ' ne s\'est pas executé correctement malgré 5 relances, code retour ' + message.getReturnStatus() + '. Ressayer et contacter le developpeur si c\'est régulier', LogType.ERROR);
      this.emit('plugwiseError', 'L\'envoi du message ' + message.output() + ' ne s\'est pas executé correctement malgré 5 relances, code retour ' + message.getReturnStatus() + '. Ressayer et contacter le developpeur si c\'est régulier');
    }
  }

  processResponse(message) {
    if (this._acknowledgedQueue[message.Sequence]) {
      clearTimeout(this._acknowledgedQueue[message.Sequence].timeoutFunction);
      if (this._acknowledgedQueue[message.Sequence].getCallback()) {
        this._acknowledgedQueue[message.Sequence].getCallback()(this._acknowledgedQueue[message.Sequence].getDevice(), message.Data);
      }
      delete this._acknowledgedQueue[message.Sequence];
      this._acknowledgedQueue.Count--;
      return true;
    }
    else Logger.log('Réception de la réponse ' + message.Type + ' sans avoir posé la question : ' + message.OriginalData, LogType.WARNING);
    return false;
  }

  processMessageQueue() {
    Logger.log('Nombre de messages en attente d\'envoi : ' + this._sendQueue.length, LogType.DEBUG);
    Logger.log('Nombre de messages correctement envoyés en attente de réponse : ' + this._acknowledgedQueue.Count, LogType.DEBUG);
    //On test le nombre de message en attente d'une réponse, si il est supérieur à 5, on attent d'avoir les réponse avant d'envoyer de nouveau message

    var nextMessage = this._sendQueue.shift();

    if (!nextMessage) {
      this._busy = false;
      return;
    }
    this._currentMessage = nextMessage;
    setTimeout(() => {
      Logger.log("Dépilage de la queue, envoi du message : " + this._currentMessage.output(), LogType.DEBUG);
      this._sp.write(this._currentMessage.output());
      this._currentMessage.dateEmitted = new Date();
      this._currentMessage.updateTryCount();
    }, 100);
  }

  _updateDeviceInformation(deviceData) {
    if (!this._deviceList[deviceData.mac]) {
      if (deviceData.type.value == PlugwiseDeviceType.CIRCLEPLUS.value) this._deviceList[deviceData.mac] = new PlugwiseCirclePlus(deviceData, this);
      else if (deviceData.type.value == PlugwiseDeviceType.CIRCLE.value) this._deviceList[deviceData.mac] = new PlugwiseCircle(deviceData, this);
      else if (deviceData.type.value == PlugwiseDeviceType.STEALTH.value) this._deviceList[deviceData.mac] = new PlugwiseStealth(deviceData, this);
      else if (deviceData.type.value == PlugwiseDeviceType.SENSE.value) this._deviceList[deviceData.mac] = new PlugwiseSense(deviceData, this);
    }
    if (this._deviceList[deviceData.mac]) this._deviceList[deviceData.mac]._updateInformation(deviceData);
    return this._deviceList[deviceData.mac];
  }

  removeDevice(mac, callback) {
    if (this._deviceList[mac]) {
      this.sendMessage(new PlugwiseOutgoingMessage(this, PlugwiseMessageConst.REMOVE_NODE_REQUEST, mac, (device, messageData) => {
        delete this._deviceList[messageData.deviceMac];
        this.emit('circleRemove', messageData.deviceMac);
      }));
    }
    else this.emit('circleRemove', mac);
  }

  getCirclePlus() {
    for (var key in this._deviceList) {
      if (this._deviceList[key].getType() == PlugwiseDeviceType.CIRCLEPLUS) return this._deviceList[key];
    }
  }

  synchronize() {
    /*var circlePlus = this.getCirclePlus();
    circlePlus.updateInformation();*/
    this.updateInformation();
    this._searchDevices();
  }

  _searchDevices() {
    Logger.log("Lancement de la recherche des équipements Plugwise");
    this._searchDevice(0);
  }

  _searchDevice(nodeID) {
    this._roleCall(nodeID, () => {
      if (nodeID == 63) Logger.log("Fin de recherche des équipements Plugwise");
      else this._searchDevice(nodeID + 1);
    });
  }

  _addDevice(mac, callback) {
    this.updateDeviceInformation(mac, callback);
  }

  updateDeviceInformation(mac, callback) {
    this.sendMessage(new PlugwiseOutgoingMessage(this, PlugwiseMessageConst.DEVICE_INFORMATION_REQUEST, mac, (stick, messageData) => {
      var device = stick._updateDeviceInformation(messageData);
      if (callback) callback(device);
    }));
  }

  _roleCall(nodeId, callback) {
    this.sendMessage(new PlugwiseOutgoingMessage(this, PlugwiseMessageConst.DEVICE_ROLECALL_REQUEST, nodeId, (stick, messageData) => {
      if (messageData.deviceMac != 'FFFFFFFFFFFFFFFF') {
        stick._addDevice(messageData.deviceMac);
      }
      if (callback) callback();
    }));
  }
}

class PlugwiseRelay extends PlugwiseDevice {
  constructor(deviceData, plugwiseStick) {
    super(deviceData.mac);
    this._stick = plugwiseStick;
    this._updateInformation(deviceData);
    Logger.log("Initialisation de l'equipement " + this.getType().name + " avec adresse MAC : " + this._mac + " terminée avec succès.");
  }

  getType() {
    return PlugwiseDeviceType.UNDEFINDED;
  }

  isOn() {
    return this._activated;
  }

  getInstantPower1s() {
    return this._power1s;
  }

  getInstantPower8s() {
    return this._power8s;
  }

  getConsumptionThisHour() {
    return this._consumptionThisHour;
    //in Wh instead of KWh return this._consumptionThisHour*1000;
  }

  getFrequency() {
    return this._hertz;
  }

  updateInformation() {
    this._stick.updateDeviceInformation(this.getMac());
  }

  _updateInformation(data) {
    this._firmwareVersion = data.firmwareVersion;
    this._hardwareVersion = data.hardwareVersion;
    this._date = data.date;
    this._updateState(data.powerState);
    this._hertz = data.hertz;
    this._stick.emit('circleUpdateInfo', this);
  }

  _getCorrectedPulses(pulses) {
    var correctedPulse = Math.pow(pulses + this._calibration.offNoise, 2) * this._calibration.gainB + (pulses + this._calibration.offNoise) * this._calibration.gainA + this._calibration.offTot;
    return (((pulses > 0 && correctedPulse > 0) || (pulses < 0 && correctedPulse < 0)) ? correctedPulse : 0);
  }

  _pulsesToWatt(correctedPulses) {
    return (correctedPulses) * PULSE_FACTOR;
  }

  _pulsesTokWh(correctedPulses) {
    return this._pulsesToWatt(correctedPulses) / (3600 * 1000)
  }

  _updatePowerInfo(data) {
    var power1s = this._pulsesToWatt(this._getCorrectedPulses(data.pulsesOneSecond));
    if (power1s < INVALID_WATT_THRESHOLD) {
      this._power1s = customRound(power1s, 2);
      this._power8s = customRound(this._pulsesToWatt(this._getCorrectedPulses(data.pulsesEightSeconds)) / 8, 2);
      this._consumptionThisHour = customRound(this._pulsesTokWh(this._getCorrectedPulses(data.pulsesConsoHour)), 6);
      this._stick.emit('circleUpdatePowerInfo', this);
    }
    else {
      Logger.log("Réception d'une consommation étrange pour " + this.getType().name + " avec adresse MAC : " + this._mac + ". message ignoré : " + JSON.stringify(data.pulsesEightSeconds), LogType.WARNING);
    }
  }

  updatePowerInfo(callback) {
    if (!this._calibration) {
      Logger.log("Calibration de " + this.getMac());
      this.calibration(() => {
        this.updatePowerInfo(callback);
      });
    }
    else this._stick.sendMessage(new PlugwiseOutgoingMessage(this, PlugwiseMessageConst.POWER_INFORMATION_REQUEST, '', (device, messageData) => {
      device._updatePowerInfo(messageData);
      if (callback) callback();
    }));
  }

  _updateCalibration(data) {
    this._calibration = data.calibration;
  }

  calibration(callback) {
    this._stick.sendMessage(new PlugwiseOutgoingMessage(this, PlugwiseMessageConst.DEVICE_CALIBRATION_REQUEST, '', (device, messageData) => {
      device._updateCalibration(messageData);
      if (callback) callback();
    }));
  }

  _updateState(state) {
    this._activated = state;
    if (state && !this._intervalTimer) {
      this._intervalTimer = setInterval(() => this.updatePowerInfo(), POWER_INTERVAL);
      setTimeout(() => this.updatePowerInfo(), 2000);
    }
    else if (!state) {
      if (this._intervalTimer) {
        clearInterval(this._intervalTimer);
        delete this._intervalTimer;
      }
      setTimeout(() => this.updatePowerInfo(), 2000);
      setTimeout(() => this.updatePowerInfo(), 9000);
    }
    this._stick.emit('circleChangeState', this);
  }

  powerOff(callback) {
    this._stick.sendMessage(new PlugwiseOutgoingMessage(this, PlugwiseMessageConst.POWER_CHANGE_REQUEST, 0, (device, messageData) => {
      device._updateState(false);
      if (callback) callback();
    }));
  }

  powerOn(callback) {
    this._stick.sendMessage(new PlugwiseOutgoingMessage(this, PlugwiseMessageConst.POWER_CHANGE_REQUEST, 1, (device, messageData) => {
      device._updateState(true);
      if (callback) callback();
    }));
  }

  toggle(callback) {
    if (this._activated) this.powerOff(callback);
    else this.powerOn(callback);
  }
}

class PlugwiseCircle extends PlugwiseRelay {
  constructor(deviceData, plugwiseStick) {
    super(deviceData, plugwiseStick);
  }

  getType() {
    return PlugwiseDeviceType.CIRCLE;
  }
}

class PlugwiseStealth extends PlugwiseRelay {
  constructor(deviceData, plugwiseStick) {
    super(deviceData, plugwiseStick);
  }

  getType() {
    return PlugwiseDeviceType.STEALTH;
  }
}

class PlugwiseCirclePlus extends PlugwiseCircle {
  constructor(deviceData, plugwiseStick) {
    super(deviceData, plugwiseStick);
    this.setClock(() => {
      Logger.log("Mise a jour clock du circlePlus plug correct");
    });
  }

  setClock(callback) {
    this._stick.sendMessage(new PlugwiseOutgoingMessage(this, PlugwiseMessageConst.CLOCK_SET_REQUEST, '', (device, messageData) => {
      if (callback) callback();
    }));
  }

  getType() {
    return PlugwiseDeviceType.CIRCLEPLUS;
  }
}

exports.PlugwiseStick = PlugwiseStick;
