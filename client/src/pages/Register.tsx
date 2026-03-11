import React, { useState } from 'react';
import { Form, Input, Button, Card, Select, message } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (v: { email: string; password: string; name: string; role?: string }) => {
    setLoading(true);
    try {
      await register(v.email, v.password, v.name, (v.role as 'user' | 'technician' | 'admin') || 'user');
      message.success('注册成功');
      navigate('/');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string }; status?: number }; message?: string };
      if (!err.response) {
        message.error('网络错误：请确认后端已启动（npm run dev），且地址为 http://localhost:3001');
        return;
      }
      const msg = err.response?.data?.error || (err.response?.status === 400 ? '请检查邮箱、密码(至少6位)、姓名是否填写正确' : '注册失败');
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: 24 }}>
      <Card title="IT 工单系统 - 注册">
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="user">
            <Select options={[
              { value: 'user', label: '普通用户' },
              { value: 'technician', label: '技术人员' },
              { value: 'admin', label: '管理员' },
            ]} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              注册
            </Button>
          </Form.Item>
          <div style={{ textAlign: 'center' }}>
            <Link to="/login">已有账号？去登录</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
}
