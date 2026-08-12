import { Box, Text, IconButton, Icon, Icons, Scroll } from 'folds';
import { Page, PageContent, PageContentCenter, PageHeader } from '../../../components/page';
import { MatrixId } from './MatrixId';
import { Profile } from './Profile';
import { ContactInformation } from './ContactInfo';
import { IgnoredUserList } from './IgnoredUserList';
import { ChangePassword } from './ChangePassword';
import { DeactivateAccount } from './DeactivateAccount';
import { IdentityServer } from './IdentityServer';

type AccountProps = {
  requestClose: () => void;
};
export function Account({ requestClose }: AccountProps) {
  return (
    <Page>
      <PageHeader outlined={false}>
        <Box grow="Yes" gap="200">
          <Box grow="Yes" alignItems="Center" gap="200">
            <Text size="H3" truncate>
              Account
            </Text>
          </Box>
          <Box shrink="No">
            <IconButton onClick={requestClose} variant="Surface">
              <Icon src={Icons.Cross} />
            </IconButton>
          </Box>
        </Box>
      </PageHeader>
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <PageContentCenter>
              <Box direction="Column" gap="700">
                <Profile />
                <MatrixId />
                <ContactInformation />
                <IdentityServer />
                <ChangePassword />
                <IgnoredUserList />
                <DeactivateAccount />
              </Box>
            </PageContentCenter>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
