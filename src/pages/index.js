import React from 'react';
import { graphql } from 'gatsby';
import { useLocation } from "@reach/router";
import Container from '@mui/material/Container';

import AuthProvider from '../components/Auth/AuthProvider';
import EcosystemProvider from '../components/Ecosystem/EcosystemProvider';
import BiomebotProvider from '../biomebot-0.11/BiomebotProvider';
import useFirebase from '../useFirebase';
import ChatRoom from '../components/ChatRoom/ChatRoom';

const useQuery = () => {
  return new URLSearchParams(useLocation().search);
};

/**
 * indexページ
 * @return {JSX.Element} indexページ
 */
export default function Index() {
  const [firebase, firestore] = useFirebase();

  const query = useQuery();
  const schemeName = query.get("schemeName");

  console.log(schemeName)
  return (
    <Container maxWidth='xs' disableGutters sx={{ height: '100vh' }}>
      <AuthProvider firebase={firebase} firestore={firestore}>
        <EcosystemProvider firestore={firestore}>
          <BiomebotProvider firestore={firestore} summon schemeName={schemeName}>
            <ChatRoom firestore={firestore} />
          </BiomebotProvider>
        </EcosystemProvider>
      </AuthProvider>
    </Container>
  );
}

export const Head = ({ data }) => (
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
