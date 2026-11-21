import snapshot from './catalog-snapshot.json' with {type:'json'};
import {fetchMyship} from './myship-source.mjs';
import {settings} from './store-settings.mjs';
export async function getCatalog(){
 try{const source=await fetchMyship({revalidate:300});return {products:source.products,settings,sync:{updatedAt:source.updatedAt,source:'myship'}};}
 catch{return {products:snapshot.products,settings,sync:{updatedAt:snapshot.updatedAt,source:'snapshot'}};}
}
