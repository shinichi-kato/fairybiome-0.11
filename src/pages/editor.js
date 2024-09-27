import React from 'react';
import { graphql } from 'gatsby';
import Container from '@mui/material/Container';
import Editor from '../components/Editor/Editor';


import AuthProvider from '../components/Auth/AuthProvider';
import useFirebase from '../useFirebase';

export default function EditorPage() {
  const [firebase, firestore] = useFirebase();

  return (
    <Container maxWidth='xs' disableGutters sx={{ height: '100vh' }}>
      <AuthProvider firebase={firebase} firestore={firestore}>
        <Editor />
      </AuthProvider>
    </Container>
  )
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