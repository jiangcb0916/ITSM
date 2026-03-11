import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Layout as AntLayout, Menu, Dropdown, Space } from 'antd';
import { UserOutlined, UnorderedListOutlined, DashboardOutlined, TeamOutlined, LogoutOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';

const { Header, Content } = AntLayout;

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { key: '/', icon: <UnorderedListOutlined />, label: <Link to="/">工单列表</Link> },
    ...(user?.role === 'admin' || user?.role === 'technician'
      ? [{ key: '/admin', icon: <DashboardOutlined />, label: <Link to="/admin">管理仪表盘</Link> }]
      : []),
    ...(user?.role === 'admin'
      ? [{ key: '/admin/users', icon: <TeamOutlined />, label: <Link to="/admin/users">用户管理</Link> }]
      : []),
  ];

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Menu theme="dark" mode="horizontal" selectedKeys={[location.pathname.startsWith('/ticket') ? '/' : location.pathname]} items={menuItems} style={{ flex: 1 }} />
        <Dropdown
          menu={{
            items: [
              { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: () => { logout(); navigate('/login'); } },
            ],
          }}
        >
          <Space style={{ color: '#fff', cursor: 'pointer' }}>
            <UserOutlined />
            <span>{user?.name} ({user?.role === 'admin' ? '管理员' : user?.role === 'technician' ? '技术人员' : '用户'})</span>
          </Space>
        </Dropdown>
      </Header>
      <Content style={{ padding: 24, background: '#f5f7fa' }}>
        <Outlet />
      </Content>
    </AntLayout>
  );
}
