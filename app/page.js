import Storefront from './storefront';
import {getCatalog} from '../scripts/catalog.mjs';
import {serverHome} from '../scripts/server-home.mjs';
import {organization,jsonLD} from '../scripts/seo.mjs';
export const revalidate=300;
export const metadata={alternates:{canonical:'/'}};
export default async function Page(){const data=await getCatalog();return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLD(organization)}}/><Storefront initialHTML={serverHome(data)} initialData={data}/></>}
