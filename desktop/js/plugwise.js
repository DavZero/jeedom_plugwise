
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

$('#bt_healthPlugwise').on('click', function () {
    $('#md_modal').dialog({title: "{{Santé Plugwise}}"});
    $('#md_modal').load('index.php?v=d&plugin=plugwise&modal=health').dialog('open');
});

$('.changeIncludeState').on('click', function () {
  var el = $(this);
  $.ajax({// fonction permettant de faire de l'ajax
    type: "POST", // methode de transmission des données au fichier php
    url: "plugins/plugwise/core/ajax/plugwise.ajax.php", // url du fichier php
    data: {
      action: "changeIncludeState",
      state: el.attr('data-state')
    },
    dataType: 'json',
    error: function(request, status, error) {
      handleAjaxError(request, status, error);
    },
    success: function(data) { // si l'appel a bien fonctionné
        if (data.state != 'ok') {
          $('#div_alert').showAlert({message:  data.result,level: 'danger'});
            return;
        }
        else {
          jeedom.config.save({
            plugin : 'plugwise',
            configuration: {autoDiscoverEqLogic: el.attr('data-state')},
            error: function (error) {
              $('#div_alert').showAlert({message: error.message, level: 'danger'});
            },
            success: function () {
              if (el.attr('data-state') == 1) {
                $.hideAlert();
                $('.changeIncludeState:not(.card)').removeClass('btn-default').addClass('btn-success');
                $('.changeIncludeState').attr('data-state', 0);
                $('.changeIncludeState.card').css('background-color','#8000FF');
                $('.changeIncludeState.card span center').text('{{Arrêter l\'inclusion}}');
                $('.changeIncludeState:not(.card)').html('<i class="fa fa-sign-in fa-rotate-90"></i> {{Arreter inclusion}}');
                $('#div_inclusionAlert').showAlert({message: '{{Vous etes en mode inclusion. Recliquez sur le bouton d\'inclusion pour sortir de ce mode}}', level: 'warning'});
              } else {
                $.hideAlert();
                $('.changeIncludeState:not(.card)').addClass('btn-default').removeClass('btn-success btn-danger');
                $('.changeIncludeState').attr('data-state', 1);
                $('.changeIncludeState:not(.card)').html('<i class="fa fa-sign-in fa-rotate-90"></i> {{Mode inclusion}}');
                $('.changeIncludeState.card span center').text('{{Mode inclusion}}');
                $('.changeIncludeState.card').css('background-color','#ffffff');
                $('#div_inclusionAlert').hideAlert();
              }
            }
          });
      }
      window.location.reload();
    }
  });
});

$('#bt_excludeEqLogic').on('click', function () {
  jeedom.eqLogic.getSelectModal({}, function (resultat){
    $.ajax({// fonction permettant de faire de l'ajax
        type: "POST", // méthode de transmission des données au fichier php
        url: "plugins/plugwise/core/ajax/plugwise.ajax.php", // url du fichier php
        data: {
            action: "removeEqLogic",
            id: resultat.id
        },
        dataType: 'json',
        error: function (request, status, error) {
            handleAjaxError(request, status, error);
        },
        success: function (data) { // si l'appel a bien fonctionné
            if (data.state != 'ok') {
                $('#div_alert').showAlert({message: data.result, level: 'danger'});
                return;
            }
        }
    });
  });
});

$('body').on('plugwise::includeDevice', function (_event,_options) {
    if (modifyWithoutSave) {
        $('#div_inclusionAlert').showAlert({message: '{{Un périphérique vient d\'être inclu. Veuillez réactualiser la page}}', level: 'warning'});
    } else {
        /*if (_options == '') {
            window.location.reload();
        } else {
            window.location.href = 'index.php?v=d&p=plugwise&m=plugwise&id=' + _options;
        }*/
        window.location.reload();
    }
});

$('body').on('plugwise::excludeDevice', function (_event,_options) {
    if (modifyWithoutSave) {
        $('#div_inclusionAlert').showAlert({message: '{{Un périphérique vient d\'être exclu. Veuillez réactualiser la page}}', level: 'warning'});
    } else {
        /*if (_options == '') {
            window.location.reload();
        } else {
            window.location.href = 'index.php?v=d&p=plugwise&m=plugwise&id=' + _options;
        }*/
        window.location.reload();
    }
});


$('#bt_syncEqLogic').on('click', function () {
  $.ajax({// fonction permettant de faire de l'ajax
      type: "POST", // méthode de transmission des données au fichier php
      url: "plugins/plugwise/core/ajax/plugwise.ajax.php", // url du fichier php
      data: {
          action: "syncEqLogic",
      },
      dataType: 'json',
      error: function (request, status, error) {
          handleAjaxError(request, status, error);
      },
      success: function (data) { // si l'appel a bien fonctionné
          if (data.state != 'ok') {
              $('#div_alert').showAlert({message: data.result, level: 'danger'});
              return;
          }
          window.location.reload();
      }
  });
});


$("#table_cmd").sortable({
  axis: "y",
  cursor: "move",
  items: ".cmd",
  placeholder: "ui-state-highlight",
  tolerance: "intersect",
  forcePlaceholderSize: true
});
/*
* Fonction pour l'ajout de commande, appellé automatiquement par plugin.template
*/

function addCmdToTable(_cmd) {
  if (!isset(_cmd)) {
    var _cmd = {
      configuration: {}
    };
  }
  if (!isset(_cmd.configuration)) {
    _cmd.configuration = {};
  }
  var tr = '<tr class="cmd" data-cmd_id="' + init(_cmd.id) + '">';
  tr += '<td>';
  tr += '<span class="cmdAttr" data-l1key="id" style="display:none;"></span>';
  tr += '<input class="cmdAttr form-control input-sm" data-l1key="name" style="width : 140px;" placeholder="{{Nom}}">';
  tr += '</td>';
  /*tr += '<td>';
  tr += '<span class="type" type="' + init(_cmd.type) + '">' + jeedom.cmd.availableType() + '</span>';
  tr += '<span class="subType" subType="' + init(_cmd.subType) + '"></span>';
  tr += '</td>';*/
  tr += '<td>';
  //tr += '<span><input type="checkbox" class="cmdAttr bootstrapSwitch" data-size="mini" data-l1key="isVisible" data-label-text="{{Afficher}}" checked/></span> ';
  tr += '<label class="checkbox-inline"><input type="checkbox" class="cmdAttr" data-l1key="isVisible" checked/>{{Afficher}}</label>';
  if (init(_cmd.type) == 'info' && (init(_cmd.subType) == 'numeric' || init(_cmd.subType) == 'binary')) {
    //tr += '<span><input type="checkbox" class="cmdAttr bootstrapSwitch" data-size="mini" data-l1key="isHistorized" data-label-text="{{Historiser}}" /></span> ';
    tr += '<label class="checkbox-inline"><input type="checkbox" class="cmdAttr" data-l1key="isHistorized" checked/>{{Historiser}}</label>';
  }
  tr += '</td>';

  tr += '<td>';
  if (is_numeric(_cmd.id)) {
    tr += '<a class="btn btn-default btn-xs cmdAction expertModeVisible" data-action="configure"><i class="fa fa-cogs"></i></a> ';
    tr += '<a class="btn btn-default btn-xs cmdAction" data-action="test"><i class="fa fa-rss"></i> {{Tester}}</a>';
  }
  //tr += '<i class="fa fa-minus-circle pull-right cmdAction cursor" data-action="remove"></i>';
  tr += '</td>';
  tr += '</tr>';
  $('#table_cmd tbody').append(tr);
  $('#table_cmd tbody tr:last').setValues(_cmd, '.cmdAttr');
  if (isset(_cmd.type)) {
    $('#table_cmd tbody tr:last .cmdAttr[data-l1key=type]').value(init(_cmd.type));
  }
  jeedom.cmd.changeType($('#table_cmd tbody tr:last'), init(_cmd.subType));
}
