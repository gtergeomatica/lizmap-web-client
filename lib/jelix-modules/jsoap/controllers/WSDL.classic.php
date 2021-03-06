<?php
/**
* @package     jelix-modules
* @subpackage  jelix
* @author      Sylvain de Vathaire
* @contributor Laurent Jouanneau
* @copyright   2008 Sylvain de Vathaire, 2012 Laurent Jouanneau
* @licence     http://www.gnu.org/licenses/gpl.html GNU General Public Licence, see LICENCE file
*/

/**
 * @package    jelix-modules
 * @subpackage jelix
 */
class WSDLCtrl extends jController {

   /**
    * Display the web service documentation for the requested service
    */
    public function index() {
        $rep = $this->getResponse('html', true);

        $webservices = jWSDL::getSoapControllers();

        if(sizeof($webservices) != 0){
            $service = $this->param('service');

            if (empty($service)) {
                $module = $webservices[0]['module'];
                $controller = $webservices[0]['class'];
            }else{
                if(!strpos($service, '~')===FALSE){
                    list($module, $controller) =  explode('~',$service);
                }
                if (empty($module) || empty($controller)) {
                    throw new JException("jsoap~errors.service.param.invalid");
                }
            }

            //Used for documentation of data structures classes
            $className = $this->param('className');

            $wsdl = new jWSDL($module, $controller);
            $doc = $wsdl->doc($className);
            $doc['menu'] = $webservices;
            $rep->body->assign("doc", $doc);
            $rep->title = "Documentation - ".$controller;
        }else{
            $rep->title = "Documentation -  Web services";
        }
        $rep->bodyTpl = 'jsoap~soap_doc';
        return $rep;
    }

    /**
    * Return the WSDL file for a soap web service
    */
    public function wsdl() {

        $rep = $this->getResponse('xml');
        $rep->sendXMLHeader = FALSE;

        $service = $this->param('service');

        if (empty($service)) {
            throw new jException("jsoap~errors.service.param.required");
        }

        if(!strpos($service, '~')===FALSE){
            list($module, $controller) =  explode('~',$service);
        }
        if (empty($module) || empty($controller)) {
            throw new jException("jsoap~errors.service.param.invalid");
        }

        $wsdl = new jWSDL($module, $controller);
        $rep->content = $wsdl->getWSDLFile();

        return $rep;
    }
}
?>