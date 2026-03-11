import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Input,
  Select,
  Space,
  Button,
  Tag,
  Modal,
  Form,
  message,
  Tooltip,
} from 'antd';
import {
  SearchOutlined,
  EditOutlined,
  StopOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import {
  listUsers,
  updateUser,
  setUserStatus,
  deleteUser,
  User,
  UserRole,
  UserStatus,
} from '../api';
import { useAuth } from '../context/AuthContext';

const roleMap: Record<UserRole, string> = {
  user: '普通用户',
  technician: '技术人员',
  admin: '管理员',
};
const statusMap: Record<UserStatus, string> = {
  active: '启用',
  disabled: '禁用',
};

const pageSize = 10;

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [transferUserId, setTransferUserId] = useState<number | null>(null);
  const [transferOptions, setTransferOptions] = useState<User[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { user: currentUser } = useAuth();

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
        ...(search.trim() && { search: search.trim() }),
        ...(roleFilter && { role: roleFilter as UserRole }),
        ...(statusFilter && { status: statusFilter as UserStatus }),
      };
      const result = await listUsers(params);
      setUsers(result.users);
      setTotal(result.total);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || '加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [page, roleFilter, statusFilter]);

  const onSearch = () => {
    setPage(1);
    loadUsers();
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue({
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      password: '',
    });
    setEditModalVisible(true);
  };

  const openDelete = async (user: User) => {
    setDeletingUser(user);
    setTransferUserId(null);
    try {
      const res = await listUsers({ limit: 500 });
      const options = res.users.filter(
        (u) => u.id !== user.id && u.id !== currentUser?.id
      );
      setTransferOptions(options);
    } catch {
      setTransferOptions([]);
    }
    setDeleteModalVisible(true);
  };

  const closeDelete = () => {
    setDeleteModalVisible(false);
    setDeletingUser(null);
    setTransferUserId(null);
  };

  const onDeleteConfirm = async () => {
    if (!deletingUser) return;
    setDeleteLoading(true);
    try {
      await deleteUser(deletingUser.id, {
        transfer_user_id: transferUserId ?? undefined,
      });
      message.success('用户已删除');
      closeDelete();
      loadUsers();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || '删除失败');
    } finally {
      setDeleteLoading(false);
    }
  };

  const closeEdit = () => {
    setEditModalVisible(false);
    setEditingUser(null);
    form.resetFields();
  };

  const onEditSubmit = async () => {
    if (!editingUser) return;
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    setSubmitLoading(true);
    try {
      const data: Parameters<typeof updateUser>[1] = {
        email: values.email,
        name: values.name,
        role: values.role,
        status: values.status,
      };
      if (values.password && values.password.trim()) {
        data.password = values.password.trim();
      }
      await updateUser(editingUser.id, data);
      message.success('保存成功');
      closeEdit();
      loadUsers();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || '保存失败');
    } finally {
      setSubmitLoading(false);
    }
  };

  const toggleStatus = async (user: User) => {
    if (user.role === 'admin') {
      message.warning('不能修改其他管理员账号');
      return;
    }
    const nextStatus: UserStatus = user.status === 'active' ? 'disabled' : 'active';
    try {
      await setUserStatus(user.id, nextStatus);
      message.success(nextStatus === 'disabled' ? '已禁用' : '已启用');
      loadUsers();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || '操作失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: '用户名', dataIndex: 'name', width: 120 },
    { title: '邮箱', dataIndex: 'email', width: 200 },
    {
      title: '角色',
      dataIndex: 'role',
      width: 100,
      render: (r: UserRole) => (
        <Tag color={r === 'admin' ? 'red' : r === 'technician' ? 'blue' : 'default'}>
          {roleMap[r]}
        </Tag>
      ),
    },
    {
      title: '账号状态',
      dataIndex: 'status',
      width: 100,
      render: (s: UserStatus) => (
        <Tag color={s === 'active' ? 'green' : 'default'}>{statusMap[s]}</Tag>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      width: 170,
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '最后登录',
      dataIndex: 'last_login_at',
      width: 170,
      render: (v: string | null) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_: unknown, record: User) => (
        <Space wrap>
          {record.role === 'admin' ? (
            <Tooltip title="不能修改其他管理员">
              <Button type="link" size="small" disabled icon={<EditOutlined />}>
                编辑
              </Button>
            </Tooltip>
          ) : (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
            >
              编辑
            </Button>
          )}
          {record.role === 'admin' ? (
            <Tooltip title="不能禁用其他管理员">
              <Button type="link" size="small" disabled>
                {record.status === 'active' ? '禁用' : '启用'}
              </Button>
            </Tooltip>
          ) : (
            <Button
              type="link"
              size="small"
              danger={record.status === 'active'}
              icon={record.status === 'active' ? <StopOutlined /> : <CheckCircleOutlined />}
              onClick={() => toggleStatus(record)}
            >
              {record.status === 'active' ? '禁用' : '启用'}
            </Button>
          )}
          {record.id === currentUser?.id ? (
            <Tooltip title="不能删除自己">
              <Button type="link" size="small" danger disabled icon={<DeleteOutlined />}>
                删除
              </Button>
            </Tooltip>
          ) : (
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => openDelete(record)}
            >
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card title="用户管理">
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="按用户名或邮箱搜索"
            style={{ width: 220 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={onSearch}
            prefix={<SearchOutlined />}
            allowClear
          />
          <Select
            placeholder="角色"
            allowClear
            style={{ width: 120 }}
            value={roleFilter || undefined}
            onChange={setRoleFilter}
          >
            {Object.entries(roleMap).map(([k, v]) => (
              <Select.Option key={k} value={k}>
                {v}
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 100 }}
            value={statusFilter || undefined}
            onChange={setStatusFilter}
          >
            {Object.entries(statusMap).map(([k, v]) => (
              <Select.Option key={k} value={k}>
                {v}
              </Select.Option>
            ))}
          </Select>
          <Button type="primary" onClick={onSearch}>
            搜索
          </Button>
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={users}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            onChange: setPage,
          }}
        />
      </Card>

      <Modal
        title="编辑用户"
        open={editModalVisible}
        onCancel={closeEdit}
        onOk={onEditSubmit}
        confirmLoading={submitLoading}
        destroyOnClose
        okText="保存"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="姓名/昵称" />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式无效' }]}
          >
            <Input placeholder="email@example.com" />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select>
              {Object.entries(roleMap).map(([k, v]) => (
                <Select.Option key={k} value={k}>
                  {v}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="status" label="账号状态" rules={[{ required: true }]}>
            <Select>
              {Object.entries(statusMap).map(([k, v]) => (
                <Select.Option key={k} value={k}>
                  {v}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="password"
            label="重置密码"
            extra="留空表示不修改密码"
            rules={[
              {
                validator(_, value) {
                  if (!value || String(value).trim().length === 0) return Promise.resolve();
                  if (String(value).length >= 6) return Promise.resolve();
                  return Promise.reject(new Error('密码至少6位'));
                },
              },
            ]}
          >
            <Input.Password placeholder="新密码（至少6位）" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="确认删除用户"
        open={deleteModalVisible}
        onCancel={closeDelete}
        onOk={onDeleteConfirm}
        confirmLoading={deleteLoading}
        okText="删除"
        okButtonProps={{ danger: true }}
        destroyOnClose
      >
        {deletingUser && (
          <>
            <p style={{ marginBottom: 16 }}>
              确定要删除用户 <strong>{deletingUser.name}</strong>（{deletingUser.email}）吗？删除后该账号将无法登录，其作为「指派人」的工单可转移给其他用户或置空。
            </p>
            <Form layout="vertical">
              <Form.Item label="将已指派给该用户的工单转移给">
                <Select
                  placeholder="不转移（工单指派人置空）"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  value={transferUserId ?? undefined}
                  onChange={(v) => setTransferUserId(v ?? null)}
                  options={transferOptions.map((u) => ({
                    value: u.id,
                    label: `${u.name} (${u.email})`,
                  }))}
                />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
}
