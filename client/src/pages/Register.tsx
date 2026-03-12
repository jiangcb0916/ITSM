import React, { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { FormOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(145deg, #f6f9fc 0%, #e6f0f5 100%)',
  padding: 24,
  boxSizing: 'border-box',
};

const cardStyle: React.CSSProperties = {
  width: '90%',
  maxWidth: 400,
  borderRadius: 8,
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  overflow: 'hidden',
};

const logoWrapperStyle: React.CSSProperties = {
  textAlign: 'center',
  paddingTop: 32,
  paddingBottom: 8,
};

const logoIconStyle: React.CSSProperties = {
  fontSize: 48,
  color: '#1890ff',
  marginBottom: 12,
};

const titleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 600,
  color: '#1890ff',
  margin: 0,
};

const subTitleStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#8c8c8c',
  marginTop: 4,
  marginBottom: 0,
};

const formWrapperStyle: React.CSSProperties = {
  width: '80%',
  margin: '0 auto',
  paddingBottom: 32,
  paddingTop: 8,
};

const loginLinkStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#8c8c8c',
  textAlign: 'center',
  display: 'block',
  marginTop: 16,
};

const footerStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 16,
  left: 0,
  right: 0,
  textAlign: 'center',
  fontSize: 12,
  color: '#bfbfbf',
};

export default function Register() {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const { register } = useAuth();
  const navigate = useNavigate();

  const clearFieldError = (name: string) => {
    form.setFields([{ name, errors: [] }]);
  };

  const onFinish = async (v: { email: string; password: string; confirmPassword?: string; name: string }) => {
    setLoading(true);
    form.setFields([
      { name: 'email', errors: [] },
      { name: 'password', errors: [] },
      { name: 'confirmPassword', errors: [] },
      { name: 'name', errors: [] },
    ]);
    try {
      await register(v.email, v.password, v.name);
      message.success('注册成功');
      navigate('/');
    } catch (e: unknown) {
      const err = e as {
        response?: { data?: { error?: string; message?: string }; status?: number };
        message?: string;
      };
      if (!err.response) {
        message.error('网络错误：请确认后端已启动（npm run dev），且地址正确');
        return;
      }
      const data = err.response?.data ?? {};
      const msg = data.message ?? data.error ?? '注册失败';
      if (err.response?.status === 400) {
        form.setFields([{ name: 'email', errors: [msg] }]);
      } else {
        message.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <Card style={cardStyle} bodyStyle={{ padding: 0 }}>
        <div style={logoWrapperStyle}>
          <div style={logoIconStyle}>
            <FormOutlined />
          </div>
          <h1 style={titleStyle}>IT 工单系统</h1>
          <p style={subTitleStyle}>注册新账号</p>
        </div>
        <div style={formWrapperStyle}>
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            onValuesChange={(changedValues) => {
              if ('email' in changedValues) clearFieldError('email');
              if ('password' in changedValues) clearFieldError('password');
              if ('confirmPassword' in changedValues) clearFieldError('confirmPassword');
              if ('name' in changedValues) clearFieldError('name');
            }}
            requiredMark={false}
          >
            <Form.Item
              name="email"
              label="邮箱"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入有效的邮箱地址' },
              ]}
              extra="仅限公司邮箱注册"
            >
              <Input placeholder="请输入邮箱" size="large" style={{ borderRadius: 6 }} />
            </Form.Item>
            <Form.Item
              name="password"
              label="密码"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少 6 位' },
              ]}
            >
              <Input.Password placeholder="请输入密码（至少 6 位）" size="large" style={{ borderRadius: 6 }} />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              label="确认密码"
              dependencies={['password']}
              rules={[
                { required: true, message: '请再次输入密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) return Promise.resolve();
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="请再次输入密码" size="large" style={{ borderRadius: 6 }} />
            </Form.Item>
            <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
              <Input placeholder="请输入姓名" size="large" style={{ borderRadius: 6 }} />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
                style={{
                  borderRadius: 6,
                  height: 44,
                  fontWeight: 500,
                }}
              >
                注册
              </Button>
            </Form.Item>
          </Form>
          <Link to="/login" style={loginLinkStyle}>
            已有账号？去登录
          </Link>
        </div>
      </Card>
      <div style={footerStyle}>© 2026 ***集团</div>
    </div>
  );
}
