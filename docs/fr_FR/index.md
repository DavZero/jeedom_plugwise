Description
===========

Ce plugin permet la gestion des prises Circle/CirclePlus de Plugwise.
![plugwise_icon](../images/plugwise_icon.png)

Configuration du plugin
=======================

Une fois le plugin activé, les dépendances doivent s’installer 
automatiquement. Si ce n’est pas le cas ou si elle ne sont pas OK,
cliquer sur relancer. Ensuite il faut définir le port USB utilisé 
pour la clé plugwise et un port pour le démon (si vous ne mettez rien 
le port utilisé sera 5001)

![plugwise_3](../images/plugwise_3.jpgG)

> **Tip**
>
> Suivant la serveur jeedom que vous utilisé, le temps
> d’installation des dépendances peut être assez long. 

Log
---

Cette partie permet de choisir le niveau de log ainsi que d’en consulter
le contenu.

![configuration05](../images/configuration05.png)

Sélectionner le niveau puis sauvegarder, le démon sera alors relancé
avec les instructions et traces sélectionnées.

Le niveau **Debug** ou **Info** peuvent être utiles pour comprendre
pourquoi le démon plante ou ne remonte pas une valeur.

> **Important**
>
> En mode **Debug** le démon est très verbeux, il est recommandé
> d’utiliser ce mode seulement si vous devez diagnostiquer un problème
> particulier. Il n’est pas recommandé de laisser tourner le démon en
> **Debug** en permanence, si on utilise une **SD-Card**. Une fois le
> debug terminé, il ne faut pas oublier de retourner sur un niveau moins
> élevé comme le niveau **Error** qui ne remonte que d’éventuelles
> erreurs.

Configuration des équipements
=============================

Il n’y a pas de paramétrage a faire en dehors de ceux du démon 
(voir le chapitre configuration). Une fois celui ci configuré, 
il va rechercher les prises de votre réseau plugwise et les créer 
dans Jeedom. Ceci devrait prendre moins d’une minute.
Ensuite vous configurer vos nouveaux equipement comme n’importe quel
equipement Jeedom.
Sur la page de gestion des équipements, vous pouvez également :
Exclure des equipements
Synchroniser les equipements entre le démon et Jeedom
Nota : l’inclusion de nouveau equipement dans le reseau plugwise depuis
Jeedom est en cours d’analyse.

![plugwlise_4](../images/plugwlise_4.jpg)

FAQ
===
.Le plugin nécessite t il des prérequis ?
Oui, il utilise un démon en nodejs et donc il faut installer les dependenances

Troubleshoting
==============
.Les boutons inclusion, exclusion et synchoniser n’apparaissent pas
Il faut être en mode expert pour que le bouton soit visible
