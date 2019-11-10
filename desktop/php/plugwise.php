<?php
if (!isConnect('admin')) {
  throw new Exception('{{401 - Accès non autorisé}}');
}
sendVarToJS('eqType', 'plugwise');
$eqLogics = eqLogic::byType('plugwise');
?>

<div class="row row-overflow">
  <div class="col-xs-12 eqLogicThumbnailDisplay">
    <legend><i class="fas fa-cog"></i> {{Gestion}}</legend>
    <div class="eqLogicThumbnailContainer">
      <div class="cursor eqLogicAction logoSecondary" data-action="gotoPluginConf">
        <i class="fas fa-wrench"></i>
        <br>
        <span>{{Configuration}}</span>
      </div>
      <div class="cursor logoSecondary" id="bt_healthPlugwise">
        <i class="fas fa-medkit"></i>
        <br>
        <span>{{Santé}}</span>
      </div>
      <div class="cursor logoSecondary expertModeVisible" id="bt_excludeEqLogic">
        <i class="fas fa-sign-in-alt fa-rotate-90"></i>
        <br>
        <span>{{Exclure}}</span>
      </div>
      <div class="cursor logoSecondary expertModeVisible" id="bt_syncEqLogic">
        <i class="fas fa-sync"></i>
        <br>
        <span>{{Synchroniser}}</span>
      </div>
      <div class="cursor logoSecondary expertModeVisible" id="bt_repairEqLogic">
        <i class="fas fa-sitemap"></i>
        <br>
        <span>{{Réparer Réseau}}</span>
      </div>
    </div>

    <legend><i class="fas fa-table"></i> {{Mes equipements}} </legend>
    <div class="eqLogicThumbnailContainer">
      <?php
      foreach ($eqLogics as $eqLogic) {
        $opacity = ($eqLogic->getIsEnable()) ? '' : 'disableCard';
        echo '  <div class="eqLogicDisplayCard cursor ' . $opacity . '" data-eqLogic_id="' . $eqLogic->getId() . '">';
        if ($eqLogic->getConfiguration('toRemove') == 1) {
          echo '<img src="plugins/plugwise/doc/images/plugwiseCircleToRemove_icon.png" />';
        } else echo '<img src="plugins/plugwise/docs/images/plugwise' . $eqLogic->getConfiguration('type') . '_icon.png" />';
        echo '   <br>';
        echo '   <span class="name">' . $eqLogic->getHumanName(true, true) . '</span>';
        echo ' </div>';
      }
      ?>
    </div>
  </div>

  <div class="col-xs-12 eqLogic" style="display: none;">
    <div class="input-group pull-right" style="display:inline-flex">
      <span class="input-group-btn">
        <a class="btn btn-default btn-sm eqLogicAction roundedLeft" data-action="configure"><i class="fas fa-cogs"></i> {{Configuration avancée}}</a>
        <a class="btn btn-sm btn-success eqLogicAction" data-action="save"><i class="fas fa-check-circle"></i> {{Sauvegarder}}</a>
        <a class="btn btn-danger btn-sm eqLogicAction roundedRight" data-action="remove"><i class="fas fa-minus-circle"></i> {{Supprimer}}</a>
      </span>
    </div>

    <ul class="nav nav-tabs" role="tablist">
      <li role="presentation"><a href="#" class="eqLogicAction" aria-controls="home" role="tab" data-toggle="tab" data-action="returnToThumbnailDisplay"><i class="fa fa-arrow-circle-left"></i></a></li>
      <li role="presentation" class="active"><a href="#eqlogictab" aria-controls="home" role="tab" data-toggle="tab"><i class="fa fa-tachometer"></i> {{Equipement}}</a></li>
      <li role="presentation"><a href="#commandtab" aria-controls="profile" role="tab" data-toggle="tab"><i class="fa fa-list-alt"></i> {{Commandes}}</a></li>
    </ul>


    <div class="tab-content" style="height:calc(100% - 50px);overflow:auto;overflow-x: hidden;">
      <div role="tabpanel" class="tab-pane active" id="eqlogictab">
        <div class="row">
          <div class="col-sm-6">
            <form class="form-horizontal">
              <fieldset>
                <br />
                <div class="form-group">
                  <label class="col-sm-3 control-label">{{Nom de l'équipement}}</label>
                  <div class="col-sm-8">
                    <input type="text" class="eqLogicAttr form-control" data-l1key="id" style="display : none;" />
                    <input type="text" class="eqLogicAttr form-control" data-l1key="name" placeholder="{{Nom de l'équipement}}" />
                  </div>
                </div>
                <div class="form-group">
                  <label class="col-sm-3 control-label">{{Objet parent}}</label>
                  <div class="col-sm-8">
                    <select id="sel_object" class="eqLogicAttr form-control" data-l1key="object_id">
                      <option value="">{{Aucun}}</option>
                      <?php
                      foreach (jeeObject::all() as $object) {
                        echo '<option value="' . $object->getId() . '">' . $object->getName() . '</option>';
                      }
                      ?>
                    </select>
                  </div>
                </div>
                <div class="form-group">
                  <label class="col-sm-3 control-label">{{Catégorie}}</label>
                  <div class="col-sm-8">
                    <?php
                    foreach (jeedom::getConfiguration('eqLogic:category') as $key => $value) {
                      echo '<label class="checkbox-inline">';
                      echo '<input type="checkbox" class="eqLogicAttr" data-l1key="category" data-l2key="' . $key . '" />' . $value['name'];
                      echo '</label>';
                    }
                    ?>
                  </div>
                </div>
                <div class="form-group">
                  <label class="col-sm-3 control-label">{{Activer}}</label>
                  <div class="col-sm-8">
                    <label class="checkbox-inline"><input type="checkbox" class="eqLogicAttr" data-l1key="isEnable" checked />{{Activer}}</label>
                    <label class="checkbox-inline"><input type="checkbox" class="eqLogicAttr" data-l1key="isVisible" checked />{{Visible}}</label>
                  </div>
                </div>
              </fieldset>
            </form>
          </div>
          <div class="col-sm-6">
            <form class="form-horizontal">
              <fieldset>
                <br />
                <div class="form-group">
                  <div class="form-group">
                    <label class="col-sm-2 control-label">{{Type}}</label>
                    <span class="col-sm-8 control-label eqLogicAttr" data-l1key="configuration" data-l2key="type"></span>
                  </div>
                  <div class="form-group">
                    <label class="col-sm-2 control-label">{{Adresse mac}}</label>
                    <span class="col-sm-8 control-label eqLogicAttr" data-l1key="configuration" data-l2key="macAddress"></span>
                  </div>
                  <div class="form-group">
                    <label class="col-sm-2 control-label">{{Version firmware}}</label>
                    <span class="col-sm-8 control-label eqLogicAttr" data-l1key="configuration" data-l2key="firmwareVersion"></span>
                  </div>
                  <div class="form-group">
                    <label class="col-sm-2 control-label">{{Version hardware}}</label>
                    <span class="col-sm-8 control-label eqLogicAttr" data-l1key="configuration" data-l2key="hardwareVersion"></span>
                  </div>
                </div>
              </fieldset>
            </form>
          </div>
        </div>
      </div>
      <div role="tabpanel" class="tab-pane" id="commandtab">
        <br />
        <table id="table_cmd" class="table table-bordered table-condensed">
          <thead>
            <tr>
              <th>{{Nom}}</th>
              <th>{{Paramètre}}</th>
              <th>{{Action}}</th>
            </tr>
          </thead>
          <tbody>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<?php include_file('desktop', 'plugwise', 'js', 'plugwise'); ?>
<?php include_file('core', 'plugin.template', 'js'); ?>