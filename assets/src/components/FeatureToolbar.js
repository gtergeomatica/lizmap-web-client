import { mainLizmap, mainEventDispatcher } from '../modules/Globals.js';
import Utils from '../modules/Utils.js';
import { html, render } from 'lit-html';

import { transformExtent } from 'ol/proj';
import { getCenter } from 'ol/extent';
import GeoJSON from 'ol/format/GeoJSON';
import GPX from 'ol/format/GPX';
import KML from 'ol/format/KML';

import '../images/svg/map-print.svg';

export default class FeatureToolbar extends HTMLElement {
    constructor() {
        super();

        this._fid = this.getAttribute('value').split('.').pop();
        this._layerId = this.getAttribute('value').replace('.' + this.fid, '');
        this._featureType = lizMap.getLayerConfigById(this.layerId)[0];
        this._parentLayerId = this.getAttribute('parent-layer-id');

        this._isFeatureEditable = true;

        // Edition can be restricted by polygon
        if (this.hasEditionRestricted){
            this._isFeatureEditable = !this.hasEditionRestricted;
        }

        this._downloadFormats = ['GeoJSON', 'GPX', 'KML'];

        // Note: Unlink button deletes the feature for pivot layer and unlinks otherwise
        this._mainTemplate = () => html`
        <div class="feature-toolbar">
            <button type="button" class="btn btn-mini feature-select ${this.attributeTableConfig ? '' : 'hide'} ${this.isSelected ? 'btn-primary' : ''}" @click=${() => this.select()} title="${lizDict['attributeLayers.btn.select.title']}"><i class="icon-ok"></i></button>
            <button type="button" class="btn btn-mini feature-filter ${this.attributeTableConfig && this.hasFilter ? '' : 'hide'} ${this.isFiltered ? 'btn-primary' : ''}" @click=${() => this.filter()} title="${lizDict['attributeLayers.toolbar.btn.data.filter.title']}"><i class="icon-filter"></i></button>
            <button type="button" class="btn btn-mini feature-zoom ${this.attributeTableConfig && this.hasGeometry ? '' : 'hide'}" @click=${() => this.zoom()} title="${lizDict['attributeLayers.btn.zoom.title']}"><i class="icon-zoom-in"></i></button>
            <button type="button" class="btn btn-mini feature-center ${this.attributeTableConfig && this.hasGeometry ? '' : 'hide'}"  @click=${() => this.center()} title="${lizDict['attributeLayers.btn.center.title']}"><i class="icon-screenshot"></i></button>
            <button type="button" class="btn btn-mini feature-edit ${this.isLayerEditable && this._isFeatureEditable ? '' : 'hide'}" @click=${() => this.edit()} title="${lizDict['attributeLayers.btn.edit.title']}"><i class="icon-pencil"></i></button>
            <button type="button" class="btn btn-mini feature-delete ${this.isDeletable ? '' : 'hide'}" @click=${() => this.delete()} title="${lizDict['attributeLayers.btn.delete.title']}"><i class="icon-trash"></i></button>
            <button type="button" class="btn btn-mini feature-unlink ${this.isUnlinkable ? '' : 'hide'}" @click=${() => this.isLayerPivot ? this.delete() : this.unlink()} title="${lizDict['attributeLayers.btn.remove.link.title']}"><i class="icon-minus"></i></button>

            ${this.isFeatureExportable
                ? html`<div class="btn-group feature-export">
                        <button type="button" class="btn btn-mini dropdown-toggle" data-toggle="dropdown" title="${lizDict['attributeLayers.toolbar.btn.data.export.title']}">
                            <i class="icon-download"></i>
                            <span class="caret"></span>
                        </button>
                        <ul class="dropdown-menu pull-right" role="menu">
                            ${this._downloadFormats.map((format) =>
                                html`<li><a href="#" @click=${() => this.export(format)}>${format}</a></li>`)}
                        </ul>
                    </div>`
                : ''
            }

            <button type="button" class="btn btn-mini feature-print" @click=${() => this.print()} title="${lizDict['print.launch']}"><i class="icon-print"></i></button>

            ${this.atlasLayouts.map( layout => html`
                <button type="button" class="btn btn-mini feature-atlas" title="${layout.title}" @click=${() => this.printAtlas(layout.title)}>
                    ${layout.icon
                    ? html`<img src="${mainLizmap.mediaURL}&path=${layout.icon}"/>`
                    : html`<svg>
                                <use xlink:href="#map-print"></use>
                            </svg>`
                }  
                </button>
            `)}
        </div>`;

        render(this._mainTemplate(), this);

        // Add tooltip on buttons
        $('.btn', this).tooltip({
            placement: 'top'
        });

        this._editableFeaturesCallBack = (editableFeatures) => {
            this.updateIsFeatureEditable(editableFeatures.properties);
            render(this._mainTemplate(), this);
        };
    }

    connectedCallback() {
        mainEventDispatcher.addListener(
            () => {
                render(this._mainTemplate(), this);
            }, ['selection.changed', 'filteredFeatures.changed']
        );

        mainEventDispatcher.addListener(
            this._editableFeaturesCallBack,
            'edition.editableFeatures'
        );
    }

    disconnectedCallback() {
        mainEventDispatcher.removeListener(
            () => {
                render(this._mainTemplate(), this);
            }, 'selection.changed'
        );

        mainEventDispatcher.removeListener(
            this._editableFeaturesCallBack,
            'edition.editableFeatures'
        );
    }

    get fid() {
        return this._fid;
    }

    get layerId() {
        return this._layerId;
    }

    get featureType() {
        return this._featureType;
    }

    get parentLayerId(){
        return this._parentLayerId;
    }

    get isSelected() {
        const selectedFeatures = lizMap.config.layers[this.featureType]['selectedFeatures'];
        return selectedFeatures && selectedFeatures.includes(this.fid);
    }

    get isFiltered() {
        const filteredFeatures = lizMap.config.layers[this.featureType]['filteredFeatures'];
        return filteredFeatures && filteredFeatures.includes(this.fid);
    }

    get hasFilter() {
        // lizLayerFilter is a global variable set only when there is a filter in the URL
        if (typeof lizLayerFilter === 'undefined'
            && (lizMap.lizmapLayerFilterActive === this.featureType || !lizMap.lizmapLayerFilterActive)){
            return true;
        }
        return false;
    }

    get hasGeometry(){
        const geometryType = lizMap.getLayerConfigById(this.layerId)[1].geometryType;
        return (geometryType != 'none' && geometryType != 'unknown');
    }

    get attributeTableConfig(){
        return lizMap.getLayerConfigById(this.layerId, lizMap.config.attributeLayers, 'layerId')?.[1];
    }

    get isLayerEditable(){
        return lizMap.config?.editionLayers?.[this.featureType]?.capabilities?.modifyAttribute === "True"
            || lizMap.config?.editionLayers?.[this.featureType]?.capabilities?.modifyGeometry === "True";
    }

    get isLayerPivot(){
        return this.attributeTableConfig?.['pivot'] === 'True';
    }

    get isUnlinkable(){
        return this.parentLayerId &&
            (this.isLayerEditable && !this.isLayerPivot) ||
            (lizMap.config?.editionLayers?.[this.featureType]?.capabilities?.deleteFeature === "True" && this.isLayerPivot);
    }

    /**
     * Feature can be deleted if it is editable & if it has delete capabilities & if layer is not pivot
     * If layer is a pivot, unlink button is displayed but a delete action is made instead
     * @readonly
     */
    get isDeletable(){
        return this._isFeatureEditable
            && lizMap.config?.editionLayers?.[this.featureType]?.capabilities?.deleteFeature === "True"
            && !this.isLayerPivot;
    }

    get hasEditionRestricted(){
        return this.getAttribute('edition-restricted') === 'true';
    }

    /**
     * Return true if childLayer has a relation with parentLayer
     *
     * @readonly
     */
    get hasRelation(){
        return lizMap.config?.relations?.[this.parentLayerId]?.some((relation) => relation.referencingLayer === this.layerId);
    }

    /**
     * Return true if layer has geometry, WFS capability and popup_allow_download = true
     *
     * @readonly
     */
    get isFeatureExportable(){
        return this.attributeTableConfig &&
                this.hasGeometry &&
                Object.entries(lizMap.config.layers).some(
                    ([ ,value]) => value?.typename == this._featureType && value?.popup_allow_download
                );
    }

    get atlasLayouts() {
        const atlasLayouts = [];

        // Lizmap >= 3.7
        this._layouts = mainLizmap.config?.layouts;

        mainLizmap.config?.printTemplates.map((template, index) => {
            if (template?.atlas?.enabled === '1') {
                // Lizmap >= 3.7
                if (mainLizmap.config?.layouts?.list) {
                    if (mainLizmap.config?.layouts?.list?.[index]?.enabled) {
                        atlasLayouts.push({
                            title: mainLizmap.config?.layouts?.list?.[index]?.layout,
                            icon: mainLizmap.config?.layouts?.list?.[index]?.icon
                        });
                    }
                    // Lizmap < 3.7
                } else {
                    atlasLayouts.push({
                        title: template?.title
                    });
                }
            }
        });

        return atlasLayouts;
    }

    updateIsFeatureEditable(editableFeatures) {
        this._isFeatureEditable = false;
        for (const editableFeature of editableFeatures) {
            const [featureType, fid] = editableFeature.id.split('.');
            if(featureType === this.featureType && fid === this.fid){
                this._isFeatureEditable = true;
                break;
            }
        }
    }

    select() {
        lizMap.events.triggerEvent('layerfeatureselected',
            { 'featureType': this.featureType, 'fid': this.fid, 'updateDrawing': true }
        );
    }

    zoom() {
        // FIXME: necessary?
        // Remove map popup to avoid confusion
        if (lizMap.map.popups.length != 0){
            lizMap.map.removePopup(lizMap.map.popups[0]);
        }

        if (this.getAttribute('crs')){
            lizMap.mainLizmap.extent = transformExtent(
                [this.getAttribute('bbox-minx'), this.getAttribute('bbox-miny'), this.getAttribute('bbox-maxx'), this.getAttribute('bbox-maxy')],
                this.getAttribute('crs'),
                lizMap.mainLizmap.projection
            );
        }else{
            lizMap.zoomToFeature(this.featureType, this.fid, 'zoom');
        }
    }

    center(){
        if (this.getAttribute('crs')) {
            lizMap.mainLizmap.center = getCenter(transformExtent(
                [this.getAttribute('bbox-minx'), this.getAttribute('bbox-miny'), this.getAttribute('bbox-maxx'), this.getAttribute('bbox-maxy')],
                this.getAttribute('crs'),
                lizMap.mainLizmap.projection
            ));
        } else {
            lizMap.zoomToFeature(this.featureType, this.fid, 'center');
        }
    }

    edit(){
        const parentFeatureId = this.getAttribute('parent-feature-id');
        if (parentFeatureId && this.hasRelation){
            const parentLayerName = lizMap.getLayerConfigById(this.parentLayerId)?.[0];
            lizMap.getLayerFeature(parentLayerName, parentFeatureId, (feat) => {
                lizMap.launchEdition(this.layerId, this.fid, { layerId: this.parentLayerId, feature: feat });
            });
        }else{
            lizMap.launchEdition(this.layerId, this.fid);
        }
    }

    delete(){
        lizMap.deleteEditionFeature(this.layerId, this.fid);
    }

    unlink(){
        // Get parent layer id
        const parentLayerId = this.parentLayerId;
        const config = lizMap.config;

        // Get foreign key column
        let fKey = null;
        if (!(parentLayerId in config.relations)){
            return false;
        }
        for (const rp in config.relations[parentLayerId]) {
            const rpItem = config.relations[parentLayerId][rp];
            if (rpItem.referencingLayer == this.layerId) {
                fKey = rpItem.referencingField
            } else {
                continue;
            }
        }
        if (!fKey)
            return false;

        // Get features for the child layer
        const features = config.layers[this.featureType]['features'];
        if (!features || Object.keys(features).length <= 0){
            return false;
        }

        // Get primary key value for clicked child item
        const primaryKey = this.attributeTableConfig?.['primaryKey'];
        if(!primaryKey){
            return false;
        }

        const afeat = features[this.fid];
        if (!afeat){
            return false;
        }

        let cPkeyVal = afeat.properties[primaryKey];
        // Check if pkey is integer
        if (!Number.isInteger(cPkeyVal)){
            cPkeyVal = " '" + cPkeyVal + "' ";
        }

        fetch(lizUrls.edition.replace('getFeature', 'unlinkChild'), {
            method: "POST",
            body: new URLSearchParams({
                repository: lizUrls.params.repository,
                project: lizUrls.params.project,
                lid: this.layerId,
                pkey: primaryKey,
                pkeyval: cPkeyVal,
                fkey: fKey
            })
        }).then(response => {
            return response.text();
        }).then( data => {
            // Show response message
            $('#lizmap-edition-message').remove();
            lizMap.addMessage(data, 'info', true).attr('id', 'lizmap-edition-message');

            // Send signal saying edition has been done on table
            lizMap.events.triggerEvent("lizmapeditionfeaturemodified",
                { 'layerId': this.layerId }
            );
        });
    }

    filter(){
        const wasFiltered = this.isFiltered;

        // First deselect all features
        lizMap.events.triggerEvent('layerfeatureunselectall',
            { 'featureType': this.featureType, 'updateDrawing': false }
        );

        if (!wasFiltered) {
            // Then select this feature only
            lizMap.events.triggerEvent('layerfeatureselected',
                { 'featureType': this.featureType, 'fid': this.fid, 'updateDrawing': false }
            );
            // Then filter for the selected features
            lizMap.events.triggerEvent('layerfeaturefilterselected',
                { 'featureType': this.featureType }
            );
            lizMap.lizmapLayerFilterActive = this.featureType;
        } else {
            // Then remove filter for this selected feature
            lizMap.events.triggerEvent('layerfeatureremovefilter',
                { 'featureType': this.featureType }
            );
            lizMap.lizmapLayerFilterActive = null;
        }
    }

    export(format){
        lizMap.mainLizmap.wfs.getFeature({
            TYPENAME: this._featureType,
            FEATUREID: this._featureType + '.' + this._fid
        }).then(response => {
            if(format == 'GeoJSON'){
                Utils.downloadFileFromString(JSON.stringify(response), 'application/geo+json', this._featureType + '.json');
            }else{
                // Convert GeoJSON to GPX or KML
                const features = (new GeoJSON()).readFeatures(response);
                if(format == 'GPX'){
                    const gpx = (new GPX()).writeFeatures(features);
                    Utils.downloadFileFromString(gpx, 'application/gpx+xml', this._featureType + '.gpx');
                }else{
                    const kml = (new KML()).writeFeatures(features);
                    Utils.downloadFileFromString(kml, 'application/vnd.google-earth.kml+xml', this._featureType + '.kml');
                }
            }
        });
    }

    /**
     * Launch browser's print box with print_popup.css applied
     * to print current popup content
     */
    print() {
        // Clone popup and insert at begin of <body>
        const clonedPopup = document.querySelector('.lizmapPopupContent').cloneNode(true);
        clonedPopup.classList.add('print', 'hide');
        document.querySelector('body').insertAdjacentElement('afterbegin', clonedPopup);

        // Add special class to body to activate CSS in print_popup.css
        document.querySelector('body').classList.add('print_popup');

        // On afterprint event, delete clonedPopup + remove special class
        window.addEventListener('afterprint', () => {
            clonedPopup.remove();
            document.querySelector('body').classList.remove('print_popup');
        }, {
            once: true
        });

        // Launch print box
        window.print();
    }

    printAtlas(templateName) {
        const projectProjection = mainLizmap.config.options.qgisProjectProjection.ref;
        const wmsParams = {
            SERVICE: 'WMS',
            REQUEST: 'GetPrint',
            VERSION: '1.3.0',
            FORMAT: 'pdf',
            TRANSPARENT: true,
            SRS: projectProjection,
            DPI: 100,
            TEMPLATE: templateName,
            ATLAS_PK: this._fid
        };

        // Add layers
        const layers = [];

        // Get active baselayer, and add the corresponding QGIS layer if needed
        const activeBaseLayerName = mainLizmap._lizmap3.map.baseLayer.name;
        const externalBaselayersReplacement = mainLizmap._lizmap3.getExternalBaselayersReplacement();
        const exbl = externalBaselayersReplacement?.[activeBaseLayerName];
        if (mainLizmap.config.layers?.[exbl]) {
            const activeBaseLayerConfig = mainLizmap.config.layers[exbl];
            if (activeBaseLayerConfig?.id && mainLizmap.config.options?.useLayerIDs == 'True') {
                layers.push(activeBaseLayerConfig.id);
            } else {
                layers.push(exbl);
            }
        }

        layers.push(this._featureType);

        wmsParams['LAYERS'] = layers.join(',');

        // Disable buttons and display message while waiting for print
        this.querySelectorAll('.feature-atlas').forEach(element => element.disabled = true);

        mainLizmap._lizmap3.addMessage(lizDict['print.started'], 'info', true).addClass('print-in-progress');

        Utils.downloadFile(mainLizmap.serviceURL, wmsParams, () => {
            this.querySelectorAll('.feature-atlas').forEach(element => element.disabled = false);

            document.querySelector('#message .print-in-progress a').click();
        });
    }
}
