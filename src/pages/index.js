import React from 'react';
import {graphql} from 'gatsby';
import Container from '@mui/material/Container';

import AuthProvider from '../components/Auth/AuthProvider';
import EcosystemProvider from '../components/Ecosystem/EcosystemProvider';
import BiomebotProvider from '../biomebot-0.11/BiomebotProvider';
import useFirebase from '../useFirebase';

/**
 * indexページ
 * @return {JSX.Element} indexページ
 */
export default function Index() {
  const [firebase, firestore] = useFirebase();

  return (
    <Container maxWidth='xs' disableGutters sx={{height: '100vh'}}>
      <AuthProvider firebase={firebase} firestore={firestore}>
        <EcosystemProvider firestore={firestore}>
          <BiomebotProvider firestore={firestore}>main</BiomebotProvider>
        </EcosystemProvider>
      </AuthProvider>
    </Container>
  );
}

export const Head = ({data}) => (
  <>
    <html lang='ja' />
    <title>{data.site.siteMetadata.title}</title>
  </>
);

export const query = graphql`
  query IndexPageQuery {
    site {
      siteMetadata {
        title
      }
    }
  }
`;
