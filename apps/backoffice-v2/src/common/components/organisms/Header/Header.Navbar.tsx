import { FunctionComponent } from 'react';
import { NavItem } from './Header.NavItem';
import { useFiltersQuery } from '../../../../domains/filters/hooks/queries/useFiltersQuery/useFiltersQuery';
import { ctw } from '../../../utils/ctw/ctw';
import { TRoutes } from '../../../../Router/types';
import { CheckSquare } from 'lucide-react';
import { useSearchParamsByEntity } from '../../../hooks/useSearchParamsByEntity/useSearchParamsByEntity';
import { useSelectEntityFilterOnMount } from '../../../../domains/entities/hooks/useSelectEntityFilterOnMount/useSelectEntityFilterOnMount';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { queryClient } from '../../../../lib/react-query/query-client';
import { env } from '../../../env/env';

/**
 * @description A nav element which wraps {@link NavItem} components of the app's routes. Supports nested routes.
 *
 * @see {@link NavItem}
 *
 * @constructor
 */
export const Navbar: FunctionComponent = () => {
  const { readyState } = useWebSocket(`${env.WEBSOCKET_URL}/?testParams=55`, {
    share: true,
    shouldReconnect: () => true,
  });

  const { data: filters } = useFiltersQuery(readyState === ReadyState.OPEN);
  const [searchParams] = useSearchParamsByEntity();
  const navItems = [
    // {
    //   text: 'Home',
    //   href: '/',
    //   icon: <Home />,
    //   key: 'nav-item-home',
    // },
  ] satisfies TRoutes;

  useSelectEntityFilterOnMount(readyState === ReadyState.OPEN);

  return (
    <nav>
      {navItems.map(({ text, key, icon, children }) => (
        <ul className={`menu menu-compact w-full space-y-2`} key={key}>
          {children?.length > 0 ? (
            <>
              <li className={`menu-title`}>
                <span className={`gap-x-2`}>{text}</span>
              </li>
              {children?.map(({ text, href, key }) => (
                <NavItem href={href} key={key}>
                  {icon} {text}
                </NavItem>
              ))}
            </>
          ) : (
            <NavItem href={''} key={key}>
              {icon} {text}
            </NavItem>
          )}
        </ul>
      ))}
      <ul className={`menu menu-compact w-full space-y-2`}>
        {filters?.map(({ id, name }) => (
          <NavItem
            href={`/en/case-management/entities?filterId=${id}`}
            key={id}
            className={ctw(`capitalize`, {
              'bg-muted font-bold': id === searchParams?.filterId,
            })}
          >
            <span>
              <CheckSquare className={`d-4`} />
            </span>{' '}
            {name}
          </NavItem>
        ))}
      </ul>
    </nav>
  );
};
