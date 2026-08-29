import {
  Sidebar,
  SidebarDivider,
  SidebarGroup,
  SidebarItem,
  SidebarScrollWrapper,
  SidebarSpace,
} from '@backstage/core-components';
import { NavContentBlueprint } from '@backstage/plugin-app-react';
import { usePermission } from '@backstage/plugin-permission-react';
import { boardsUsePermission } from '@internal/plugin-boards-common';
import { SidebarLogo } from './SidebarLogo';
import MenuIcon from '@material-ui/icons/Menu';
import SearchIcon from '@material-ui/icons/Search';
import { SidebarSearchModal } from '@backstage/plugin-search';
import { UserSettingsSignInAvatar } from '@backstage/plugin-user-settings';
import { NotificationsSidebarItem } from '@backstage/plugin-notifications';
import { ReactNode } from 'react';

/**
 * Hides the boards nav item from viewers the permission framework denies
 * `boards.use`. The nav list is derived from page extensions and cannot
 * consult permissions itself, so the gate lives here in the app. Fails
 * open on a permission-api error — the boards backend enforces the
 * decision regardless.
 */
function IfBoardsAllowed(props: { children: ReactNode }) {
  const { loading, allowed, error } = usePermission({
    permission: boardsUsePermission,
  });
  if (loading || (!allowed && error === undefined)) {
    return null;
  }
  return <>{props.children}</>;
}

export const SidebarContent = NavContentBlueprint.make({
  params: {
    component: ({ navItems }) => {
      const nav = navItems.withComponent(item => (
        <SidebarItem icon={() => item.icon} to={item.href} text={item.title} />
      ));

      // Skipped items
      nav.take('page:search'); // Using search modal instead
      nav.take('page:notifications'); // Using NotificationsSidebarItem manually instead

      const boardsItem = nav.take('page:boards');

      return (
        <Sidebar>
          <SidebarLogo />
          <SidebarGroup label="Search" icon={<SearchIcon />} to="/search">
            <SidebarSearchModal />
          </SidebarGroup>
          <SidebarDivider />
          <SidebarGroup label="Menu" icon={<MenuIcon />}>
            {nav.take('page:home')}
            {nav.take('page:catalog')}
            {nav.take('page:scaffolder')}
            <SidebarDivider />
            <SidebarScrollWrapper>
              <IfBoardsAllowed>{boardsItem}</IfBoardsAllowed>
              {nav.rest({ sortBy: 'title' })}
            </SidebarScrollWrapper>
          </SidebarGroup>
          <SidebarSpace />
          <SidebarDivider />
          <NotificationsSidebarItem />
          <SidebarDivider />
          <SidebarGroup
            label="Settings"
            icon={<UserSettingsSignInAvatar />}
            to="/settings"
          >
            {nav.take('page:app-visualizer')}
            {nav.take('page:user-settings')}
          </SidebarGroup>
        </Sidebar>
      );
    },
  },
});
