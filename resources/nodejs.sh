#!/bin/bash
######################### INCLUSION LIB ##########################
BASEDIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
wget https://raw.githubusercontent.com/NebzHB/dependance.lib/master/dependance.lib -O $BASEDIR/dependance.lib &>/dev/null
PLUGIN=$(basename "$(realpath $BASEDIR/..)")
. ${BASEDIR}/dependance.lib
##################################################################
TIMED=1
wget https://raw.githubusercontent.com/NebzHB/nodejs_install/main/install_nodejs.sh -O $BASEDIR/install_nodejs.sh &>/dev/null

installVer='14' 	#NodeJS major version to be installed

pre
step 0 "Vérification des droits"
DIRECTORY="/var/www"
if [ ! -d "$DIRECTORY" ]; then
	silent sudo mkdir $DIRECTORY
fi
silent sudo chown -R www-data $DIRECTORY

step 5 "Mise à jour APT et installation des packages nécessaires"
try sudo apt-get update

#install nodejs, steps 10->50
. ${BASEDIR}/install_nodejs.sh ${installVer}

step 60 "Nettoyage anciens modules"
cd ${BASEDIR};
#remove old local modules
#silent sudo rm -rf node_modules
#silent sudo rm -f package-lock.json
cd ../node/
npm cache clean
sudo npm cache clean
sudo rm -rf node_modules

step 70 "Installation des librairies du démon, veuillez patienter svp"
#silent sudo mkdir node_modules 
#silent sudo chown -R www-data:www-data . 
#try sudo npm install --no-fund --no-package-lock --no-audit
#silent sudo chown -R www-data:www-data . 
silent sudo mkdir node_modules
silent sudo chown -R www-data:www-data node_modules


step 80
sudo npm install --unsafe-perm serialport
step 82
sudo npm install --unsafe-perm events
step 84
sudo npm install --unsafe-perm crc
step 86
sudo npm install --unsafe-perm request
step 88
sudo npm install --unsafe-perm net
step 90

sudo chown -R www-data *

post
