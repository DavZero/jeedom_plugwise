<?php

/* This file is part of Jeedom.
*
* Jeedom is free software: you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
*
* Jeedom is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
* GNU General Public License for more details.
*
* You should have received a copy of the GNU General Public License
* along with Jeedom. If not, see <http://www.gnu.org/licenses/>.
*/

/* * ***************************Includes********************************* */
require_once dirname(__FILE__) . '/../../../../core/php/core.inc.php';

class plugwise extends eqLogic {
	/*     * *************************Attributs****************************** */

	/*     * ***********************Methode static*************************** */
  public static function event()
  {
    $eventType = init('eventType');
    log::add('plugwise', 'debug', 'Passage dans la fonction event ' . $eventType);
    if ($eventType == 'error'){
      log::add('plugwise', 'error', init('description'));
      //throw new Exception('Plugwise event Error : ' . init('description'));
      return;
    }

    $macAddress = init('mac');
    if ($macAddress == ''){
      log::add('plugwise', 'error', 'L\'adresse mac est necessaire impossible de traiter le message');
      throw new Exception('Plugwise event Error : ' . 'L\'adresse mac est necessaire impossible de traiter le message');
      return;
    }

    $eqp = eqlogic::byLogicalId($macAddress,'plugwise');

    if (!is_object($eqp) && $eventType == 'updateInfo'){
      log::add('plugwise', 'info', 'création de l\'équipement ' . $macAddress . ' de type ' + init('eqpType'));
      $eqp = new plugwise();
      $eqp->setEqType_name('plugwise');
      $eqp->setLogicalId($macAddress);
      $eqp->setName($macAddress);
      $eqp->setConfiguration('macAddress', $macAddress);
      $eqp->setConfiguration('type', init('eqpType'));
      $eqp->setIsEnable(1);
      $eqp->save();
      event::add('plugwise::includeDevice', $eqp->getId());
    }

    switch ($eventType)
    {
      case 'updateInfo':
        log::add('plugwise', 'info', 'Mise a jour des informations de l\'equipement ' .$eqp->getConfiguration('macAddress') );
        if (init('firmwareVersion')) $eqp->setConfiguration('firmwareVersion', init('firmwareVersion'));
        if (init('hardwareVersion')) $eqp->setConfiguration('hardwareVersion', init('hardwareVersion'));
        if (init('type')) $eqp->setConfiguration('type', init('eqpType'));
        $eqp->setConfiguration('toRemove',0);
        if (init('frequency')) $eqp->setConfiguration('frequency', init('frequency'));
        if (init('state') == 'On'){
          $eqp->getCmd('info', 'state')->event(1);
        }
        else if (init('state') == 'Off'){
          $eqp->getCmd('info', 'state')->event(0);
        }
        $eqp->save();
        break;
      case 'updatePowerInfo':
        log::add('plugwise', 'info', 'Mise a jour la consommation de l\'equipement ' .$eqp->getConfiguration('macAddress') );
        $cmd = $eqp->getCmd('info', 'puissance');
        $puissance = init('power');
        if (is_object($cmd))
        {
          $eqp->checkAndUpdateCmd($cmd,init('power'));
        }
        else
        {
          log::add('plugwise', 'error', 'Impossible de trouver la commande de puissance de l\'equipement ' . $macAddress);
          //throw new Exception('Impossible de trouver la commande de statut de l\'equipement ' + $macAddress);
        }

        $cmd = $eqp->getCmd('info', 'puissance8s');
        if (is_object($cmd))
        {
          $eqp->checkAndUpdateCmd($cmd,init('power8s'));
        }
        else
        {
          log::add('plugwise', 'error', 'Impossible de trouver la commande de puissance sur les 8 dernières secondes de l\'equipement ' . $macAddress);
          //throw new Exception('Impossible de trouver la commande de statut de l\'equipement ' + $macAddress);
        }

        $cmd = $eqp->getCmd('info', 'consumptionThisHour');
        $consumptionThisHour = init('consumptionThisHour');
        $oldConsumptionThisHour = 0;
        if (is_object($cmd))
        {
          $oldConsumptionThisHour = $cmd->getConfiguration('value',0);
          if ($eqp->checkAndUpdateCmd($cmd,$consumptionThisHour))
          {
            $cmd->setConfiguration('value',$consumptionThisHour);
            $cmd->save();
          }
        }
        else
        {
          log::add('plugwise', 'error', 'Impossible de trouver la commande de consommation de l\'heure en cours de l\'equipement ' . $macAddress);
          //throw new Exception('Impossible de trouver la commande de statut de l\'equipement ' + $macAddress);
        }
        $cmdTotal = $eqp->getCmd('info', 'consumptionTotal');
        if (is_object($cmdTotal) && is_object($cmd))
        {
          $deltaConsumption = $consumptionThisHour-$oldConsumptionThisHour;
          $totalConsumption = $cmdTotal->getConfiguration('value',0);
          if ($deltaConsumption >= 0) $totalConsumption += $deltaConsumption;
          else $totalConsumption += $consumptionThisHour;
          if ($eqp->checkAndUpdateCmd($cmdTotal,$totalConsumption))
          {
            $cmdTotal->setConfiguration('value',$totalConsumption);
            $cmdTotal->save();
          }
        }
        else
        {
          log::add('plugwise', 'error', 'Impossible de trouver la commande de consommation total l\'equipement ' . $macAddress);
          //throw new Exception('Impossible de trouver la commande de statut de l\'equipement ' + $macAddress);
        }
        break;

      case 'changeState':
        log::add('plugwise', 'info', 'Mise a jour l\'etat (on/off) de l\'equipement ' .$eqp->getConfiguration('macAddress') );
        $cmd = $eqp->getCmd('info', 'state');
        $newVal = 0;
        if (init('state') == 'On') $newVal = 1;

        if (is_object($cmd))
        {
          $eqp->checkAndUpdateCmd($cmd,$newVal);
        }
        else
        {
          log::add('plugwise', 'error', 'Impossible de trouver la commande de statut de l\'equipement ' . $macAddress);
          //throw new Exception('Impossible de trouver la commande de statut de l\'equipement ' + $macAddress);
        }
        break;

      case 'senseValue':
        log::add('plugwise', 'info', 'Mise a jour des infos de l\'equipement ' .$eqp->getConfiguration('macAddress') );
        if (init('humidity'))
        {
          $cmd = $eqp->getCmd('info', 'humidity');
          if (is_object($cmd))
          {
            $eqp->checkAndUpdateCmd($cmd,init('humidity'));
          }
          else
          {
            log::add('plugwise', 'error', 'Impossible de trouver la commande humidité de l\'equipement ' . $macAddress);
            //throw new Exception('Impossible de trouver la commande de statut de l\'equipement ' + $macAddress);
          }
        }
        if (init('temperature'))
        {
          $cmd = $eqp->getCmd('info', 'temperature');
          if (is_object($cmd))
          {
            $eqp->checkAndUpdateCmd($cmd,init('temperature'));
          }
          else
          {
            log::add('plugwise', 'error', 'Impossible de trouver la commande temperature de l\'equipement ' . $macAddress);
            //throw new Exception('Impossible de trouver la commande de statut de l\'equipement ' + $macAddress);
          }
        }
        break;

      case 'removeEquipment':
        log::add('plugwise', 'info', 'Suppression de l\'equipement ' . $macAddress );
        if (is_object($eqp)) {
          //Pour être sur de ne pas perdre l'historique c'est l'utilisateur qui doit supprimer manuellement l'equipements
          //On flag tous de même l'equipements
          $eqp->setConfiguration('toRemove',1);
          $eqp->save();
          //$eqp->remove();
          event::add('plugwise::excludeDevice', $eqp->getId());
        }
        break;
    }
  }

  public static function changeIncludeState($newState)
  {
    plugwise::sendToController('STICK','SETINCLUDESTATE',$newState);
  }

  public static function synchronize()
  {
    plugwise::sendToController('STICK','SYNCHRONIZE');
  }

  public static function removeEqLogic($id)
  {
    $eqp = eqlogic::byId($id);
    if (is_object($eqp) && $eqp->getEqType_name()){
      plugwise::sendToController('STICK','REMOVEEQP',$eqp->getConfiguration('macAddress'));
    }
    else {
      log::add('plugwise', 'error', 'L\'equipement selectionner pour suppression n\'est pas valide');
    }
  }


  public static function health() {
    $return = array();
    $urlService = '127.0.0.1';
    $servicePort = config::byKey('servicePort', 'plugwise');
    if ($servicePort == '') $servicePort = 5001;

    $fp = fsockopen($urlService, $servicePort, $errno, $errstr);

    $return[] = array(
      'test' => __('Serveur Plugwise', __FILE__),
      'result' => ($fp) ?  __('OK', __FILE__) : (__('Erreur : ', __FILE__)).$errno.', '.$errstr,
      'advice' => ($fp) ? '' : __('Indique si le serveur plugwise est en route', __FILE__),
      'state' => $fp,
    );
    fclose($fp);
    return $return;
  }

  public static function deamon_info() {
    $return = array();
    $return['log'] = 'plugwise_deamon';
    $return['state'] = 'nok';
    $pid = trim( shell_exec ('ps ax | grep "plugwise/node/plugwiseDeamon.js" | grep -v "grep" | wc -l') );
    if ($pid != '' && $pid != '0') {
      $return['state'] = 'ok';
    }
    $return['launchable'] = 'ok';

    $port = config::byKey('serialPort', 'plugwise');
		$port = jeedom::getUsbMapping($port);
		if (@!file_exists($port)) {
			$return['launchable'] = 'nok';
			$return['launchable_message'] = __('Le port n\'est pas configuré', __FILE__);
		}
		return $return;
  }

  public static function dependancy_info() {
    $return = array();
    $return['log'] = 'plugwise_dep';
    $serialport = realpath(dirname(__FILE__) . '/../../node/node_modules/serialport');
    $crc = realpath(dirname(__FILE__) . '/../../node/node_modules/crc');
    //$moment = realpath(dirname(__FILE__) . '/../../node/node_modules/moment');
    $request = realpath(dirname(__FILE__) . '/../../node/node_modules/request');
    $net = realpath(dirname(__FILE__) . '/../../node/node_modules/net');
    $return['progress_file'] = '/tmp/plugwise_dep';
    if (is_dir($serialport) && is_dir($crc) && is_dir($net) && is_dir($request)) {
      $return['state'] = 'ok';
    } else {
      $return['state'] = 'nok';
    }
    return $return;
  }

  public static function dependancy_install() {
    log::add('plugwise','info','Installation des dépéndances nodejs');
    $resource_path = realpath(dirname(__FILE__) . '/../../resources');
    passthru('/bin/bash ' . $resource_path . '/nodejs.sh ' . $resource_path . ' > ' . log::getPathToLog('plugwise_dep') . ' 2>&1 &');
  }

  public static function deamon_start() {
    self::deamon_stop();

    $deamon_info = self::deamon_info();
    if ($deamon_info['launchable'] != 'ok') {
      throw new Exception(__('Veuillez vérifier la configuration', __FILE__));
    }
    log::add('plugwise', 'info', 'Lancement du démon plugwise');
    $serialPort = jeedom::getUsbMapping(config::byKey('serialPort', 'plugwise'));
    if ($serialPort == '' ) {
      throw new Exception(__('Le port : ', __FILE__) . $port . __(' n\'existe pas', __FILE__));
    }
    $servicePort = config::byKey('servicePort', 'plugwise');
    if ($servicePort == '') $servicePort = 5001;
    $url  = network::getNetworkAccess().'/core/api/jeeApi.php?api='.config::byKey('api');
    plugwise::launch_svc($url, $serialPort, $servicePort);
  }

  public static function launch_svc($url, $serialPort, $servicePort)
  {
    $logLevel = log::convertLogLevel(log::getLogLevel('plugwise'));
    $deamonPath = realpath(dirname(__FILE__) . '/../../node');
    $cmd = 'nice -n 19 nodejs ' . $deamonPath . '/plugwiseDeamon.js ' . $url . ' ' . $serialPort . ' ' . $servicePort . ' ' . $logLevel;

    log::add('plugwise', 'debug', 'Lancement démon plugwise : ' . $cmd);

    $result = exec('nohup ' . $cmd . ' >> ' . log::getPathToLog('plugwise_deamon') . ' 2>&1 &');
    if (strpos(strtolower($result), 'error') !== false || strpos(strtolower($result), 'traceback') !== false) {
      log::add('plugwise', 'error', $result);
      return false;
    }

    $i = 0;
    while ($i < 30) {
      $deamon_info = self::deamon_info();
      if ($deamon_info['state'] == 'ok') {
        break;
      }
      sleep(1);
      $i++;
    }
    if ($i >= 30) {
      log::add('plugwise', 'error', 'Impossible de lancer le démon plugwise, vérifiez le port', 'unableStartDeamon');
      return false;
    }
    message::removeAll('plugwise', 'unableStartDeamon');
    log::add('plugwise', 'info', 'Démon plugwise lancé');
    return true;
  }

  public static function deamon_stop() {
    exec('kill $(ps aux | grep "plugwise/node/plugwiseDeamon.js" | awk \'{print $2}\')');
    log::add('plugwise', 'info', 'Arrêt du service plugwiseDeamon');
    $deamon_info = self::deamon_info();
    if ($deamon_info['state'] == 'ok') {
      sleep(1);
      exec('kill -9 $(ps aux | grep "plugwise/node/plugwiseDeamon.js" | awk \'{print $2}\')');
    }
    $deamon_info = self::deamon_info();
    if ($deamon_info['state'] == 'ok') {
      sleep(1);
      exec('sudo kill -9 $(ps aux | grep "plugwise/node/plugwiseDeamon.js" | awk \'{print $2}\')');
    }
  }

  public static function sendToController( $macAddress, $request, $param = '' ) {
    $urlService = '127.0.0.1';
    $servicePort = config::byKey('servicePort', 'plugwise');
    if ($servicePort == '') $servicePort = 5001;
    $msg = '{"macAddress":"'.$macAddress.'","command":"'.$request.'","parameter":"'.$param.'"}';
    log::add('plugwise', 'info', $msg);
    $fp = fsockopen($urlService, $servicePort, $errno, $errstr);
    if (!$fp) {
      log::add('plugwise','error',$errno.' - '.$errstr);
    } else {
      fwrite($fp, $msg);
      fclose($fp);
    }
  }

  /*     * *********************Méthodes d'instance************************* */
  private function addCmds()
	{
		try {
      if ($this->getConfiguration('type') == 'Circle' || $this->getConfiguration('type') == 'CirclePlus')
      {
        //Etat
  			$cmd = $this->getCmd(null, 'state');
  			if (!is_object($cmd)) {
  				$cmd = new plugwiseCmd();
  				$cmd->setName(__('Etat', __FILE__));
  				$cmd->setLogicalId('state');
  				$cmd->setEqLogic_id($this->getId());
  				$cmd->setUnite('');
  				$cmd->setType('info');
  				$cmd->setSubType('binary');
  				$cmd->setIsVisible(1);
          $cmd->setConfiguration('value',0);
  				$cmd->save();
  				$cmd->event(0);
  			}
        $cmdState = $cmd;

  			//On
  			$cmd = $this->getCmd(null, 'on');
  			if (!is_object($cmd)) {
  				$cmd = new plugwiseCmd();
  				$cmd->setName(__('On', __FILE__));
  				$cmd->setLogicalId('on');
  				$cmd->setEqLogic_id($this->getId());
  				$cmd->setType('action');
  				$cmd->setSubType('other');
  				$cmd->setIsVisible(1);
          //$cmd->setValue($cmdState->getId());
          $cmd->setConfiguration('request','SWITCHON');
          //$cmd->setConfiguration('stateValue',1);
  				$cmd->save();
  			}

        //Off
  			$cmd = $this->getCmd(null, 'off');
  			if (!is_object($cmd)) {
  				$cmd = new plugwiseCmd();
  				$cmd->setName(__('Off', __FILE__));
  				$cmd->setLogicalId('off');
  				$cmd->setEqLogic_id($this->getId());
  				$cmd->setType('action');
  				$cmd->setSubType('other');
  				$cmd->setIsVisible(1);
          $cmd->setConfiguration('request','SWITCHOFF');
  				$cmd->save();
        }

        //updateInfo
  			$cmd = $this->getCmd(null, 'refreshInfo');
  			if (!is_object($cmd)) {
  				$cmd = new plugwiseCmd();
  				$cmd->setName(__('Rafraichir Information', __FILE__));
  				$cmd->setLogicalId('refreshInfo');
  				$cmd->setEqLogic_id($this->getId());
  				$cmd->setType('action');
  				$cmd->setSubType('other');
  				$cmd->setIsVisible(0);
          $cmd->setConfiguration('request','INFO');
  				$cmd->save();
  			}

        //updateInfo
  			$cmd = $this->getCmd(null, 'ResetConsumption');
  			if (!is_object($cmd)) {
  				$cmd = new plugwiseCmd();
  				$cmd->setName(__('RAZ Consommation total', __FILE__));
  				$cmd->setLogicalId('ResetConsumption');
  				$cmd->setEqLogic_id($this->getId());
  				$cmd->setType('action');
  				$cmd->setSubType('other');
  				$cmd->setIsVisible(0);
          $cmd->setConfiguration('request','RAZCONSUMPTION');
  				$cmd->save();
  			}
  /*
        //Calibration
  			$cmd = $this->getCmd(null, 'refreshCalibration');
  			if (!is_object($cmd)) {
  				$cmd = new plugwiseCmd();
  				$cmd->setName(__('Recalibration', __FILE__));
  				$cmd->setLogicalId('refreshCalibration');
  				$cmd->setEqLogic_id($this->getId());
  				$cmd->setType('action');
  				$cmd->setSubType('other');
  				$cmd->setIsVisible(0);
          //$cmd->setValue($cmdState->getId());
          $cmd->setConfiguration('request','CALIBRATION');
          //$cmd->setConfiguration('stateValue',1);
  				$cmd->save();
  			}

        //PowerInfo
  			$cmd = $this->getCmd(null, 'refreshPowerInfo');
  			if (!is_object($cmd)) {
  				$cmd = new plugwiseCmd();
  				$cmd->setName(__('Rafraichir consommation', __FILE__));
  				$cmd->setLogicalId('refreshPowerInfo');
  				$cmd->setEqLogic_id($this->getId());
  				$cmd->setType('action');
  				$cmd->setSubType('other');
  				$cmd->setIsVisible(0);
          //$cmd->setValue($cmdState->getId());
          $cmd->setConfiguration('request','POWERINFO');
          //$cmd->setConfiguration('stateValue',1);
  				$cmd->save();
  			}
  */
        //Puissance instantannée
        $cmd = $this->getCmd(null, 'puissance');
    		if (!is_object($cmd)) {
    			$cmd = new plugwiseCmd();
    			$cmd->setName(__('Puissance', __FILE__));
    			$cmd->setLogicalId('puissance');
    			$cmd->setEqLogic_id($this->getId());
    			$cmd->setUnite('W');
    			$cmd->setType('info');
    			$cmd->setSubType('numeric');
    			$cmd->setIsVisible(1);
    			$cmd->save();
    		}

        //Puissance moyenne sur 8 secondes
        $cmd = $this->getCmd(null, 'puissance8s');
    		if (!is_object($cmd)) {
    			$cmd = new plugwiseCmd();
    			$cmd->setName(__('Puissance moyenne 8 dernières secondes', __FILE__));
    			$cmd->setLogicalId('puissance8s');
    			$cmd->setEqLogic_id($this->getId());
    			$cmd->setUnite('W');
    			$cmd->setType('info');
    			$cmd->setSubType('numeric');
    			$cmd->setIsVisible(0);
    			$cmd->save();
    		}

        //Consommation dans l'heure
        $cmd = $this->getCmd(null, 'consumptionThisHour');
    		if (!is_object($cmd)) {
    			$cmd = new plugwiseCmd();
    			$cmd->setName(__('Consommation heure en cours', __FILE__));
    			$cmd->setLogicalId('consumptionThisHour');
    			$cmd->setEqLogic_id($this->getId());
    			$cmd->setUnite('kWh');
    			$cmd->setType('info');
    			$cmd->setSubType('numeric');
    			$cmd->setIsVisible(0);
    			$cmd->save();
    		}

        //Consommation total
        $cmd = $this->getCmd(null, 'consumptionTotal');
    		if (!is_object($cmd)) {
    			$cmd = new plugwiseCmd();
    			$cmd->setName(__('Consommation total', __FILE__));
    			$cmd->setLogicalId('consumptionTotal');
    			$cmd->setEqLogic_id($this->getId());
    			$cmd->setUnite('kWh');
    			$cmd->setType('info');
    			$cmd->setSubType('numeric');
    			$cmd->setIsVisible(0);
    			$cmd->save();
    		}
      }
      else if ($this->getConfiguration('type') == 'Stick')
      {
        //Add command for stick
      }
      else if ($this->getConfiguration('type') == 'Sense')
      {
        //Puissance moyenne sur 8 secondes
        $cmd = $this->getCmd(null, 'humidity');
    		if (!is_object($cmd)) {
    			$cmd = new plugwiseCmd();
    			$cmd->setName(__('Humidité', __FILE__));
    			$cmd->setLogicalId('humidity');
    			$cmd->setEqLogic_id($this->getId());
    			$cmd->setUnite('%');
    			$cmd->setType('info');
    			$cmd->setSubType('numeric');
    			$cmd->setIsVisible(0);
    			$cmd->save();
    		}

        //Puissance moyenne sur 8 secondes
        $cmd = $this->getCmd(null, 'temperature');
    		if (!is_object($cmd)) {
    			$cmd = new plugwiseCmd();
    			$cmd->setName(__('Temperature', __FILE__));
    			$cmd->setLogicalId('temperature');
    			$cmd->setEqLogic_id($this->getId());
    			$cmd->setUnite('°C');
    			$cmd->setType('info');
    			$cmd->setSubType('numeric');
    			$cmd->setIsVisible(0);
    			$cmd->save();
    		}
      }



  	} catch (Exception $e) {
  			log::add('plugwise','error', displayExeption($e).', errCode : '.$e->getCode());
  			throw $e;
  	}
  }

  public function setAppMobileParameters($forceParam = false)
  {
    $params = array(
      'on'=>'ENERGY_ON',
      'off'=>'ENERGY_OFF',
      'state'=>'ENERGY_STATE',
      'puissance'=>'POWER',
      'consumptionTotal'=>'CONSUMPTION',
      'consumptionThisHour' =>'DONT',
      'puissance8s' =>'DONT',
      'ResetConsumption' =>'DONT',
      'refreshInfo' =>'DONT'
    );

    foreach($this->getCmd() as $cmd)
    {
      if ($cmd->getDisplay('generic_type')=='' || $forceParam)
      $cmd->setDisplay('generic_type',$params[$cmd->getLogicalId()]);
      $cmd->save();
    }
  }

	/*public function preInsert() {

	}*/

	/*public function postInsert() {

	}*/

	/*public function preUpdate() {
		//log::add('plugwise', 'debug', 'PreUpdate');
	}*/

	/*public function postUpdate() {
		//log::add('plugwise', 'debug', 'PostUpdate');
	}*/

	/*public function preSave() {
		//log::add('plugwise', 'debug', 'PreSave');
		//checkmacAddress();
    $this->addCircleCmds();
	}*/

	public function postSave() {
    $this->addCmds();
	}

	/*public function preRemove() {

	}*/

	/*public function postRemove() {
		//log::add('plugwise', 'debug', 'PostRemove');
	}*/

	/*
	* Non obligatoire mais permet de modifier l'affichage du widget si vous en avez besoin
	public function toHtml($_version = 'dashboard') {

}
*/

/*     * **********************Getteur Setteur*************************** */
}

class plugwiseCmd extends cmd {
	/*     * *************************Attributs****************************** */

	/*     * ***********************Methode static*************************** */

	/*     * *********************Methode d'instance************************* */
  /*public function preSave() {

	}*/

	/*public function postSave() {

	}*/

	/*
	* Non obligatoire permet de demander de ne pas supprimer les commandes même si elles ne sont pas dans la nouvelle configuration de l'équipement envoyé en JS
	public function dontRemoveCmd() {
	return true;
}
*/

	public function execute($_options = array()) {
		//log::add('plugwise', 'info', 'execute '.$this->getLogicalId());
		switch ($this->getType()) {
			/*case 'info':
				return $this->getConfiguration('value');
				break;*/
			case 'action':
        if ($this->getConfiguration('request') == 'RAZCONSUMPTION'){
          $cmdTotal = $this->getEqLogic()->getCmd('info', 'consumptionTotal');
          if (is_object($cmdTotal)){
            if ($this->getEqLogic()->checkAndUpdate($this,0))
            {
              $cmdTotal->setConfiguration('value',0);
              $cmdTotal->save();
            }
          }
        }
        else plugwise::sendToController($this->getEqLogic()->getConfiguration('macAddress'),$this->getConfiguration('request'),$this->getConfiguration('parameters'));
				break;
		}
	}
/*     * **********************Getteur Setteur*************************** */
}

?>
