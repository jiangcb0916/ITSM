import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Tag,
  Button,
  Input,
  List,
  message,
  Select,
  Upload,
  Space,
  Popconfirm,
  Row,
  Col,
  Descriptions,
  Timeline,
  Avatar,
  Typography,
  Modal,
  Image,
  Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined,
  UploadOutlined,
  EditOutlined,
  SaveOutlined,
  DeleteOutlined,
  UserOutlined,
  CommentOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  PictureOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { api, Ticket, Comment, Attachment, TicketStatus, TicketPriority, TicketCategory, getTechs } from '../api';
import type { TechUser } from '../api';
import { useAuth } from '../context/AuthContext';

const { TextArea } = Input;
const { Text } = Typography;

const statusMap: Record<TicketStatus, string> = {
  pending: '待处理',
  in_progress: '处理中',
  completed: '已完成',
  closed: '已关闭',
};
const priorityMap: Record<TicketPriority, string> = { low: '低', medium: '中', high: '高' };
const categoryMap: Record<TicketCategory, string> = {
  network: '网络故障',
  software: '软件问题',
  hardware: '硬件问题',
  other: '其他',
};

const priorityColors: Record<TicketPriority, string> = {
  high: 'red',
  medium: 'orange',
  low: 'green',
};

const statusColors: Record<TicketStatus, string> = {
  pending: 'default',
  in_progress: 'processing',
  completed: 'success',
  closed: 'default',
};

function formatDateTime(s: string) {
  return new Date(s).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 根据 MIME 或扩展名判断是否为图片 */
function isImageAttachment(a: Attachment): boolean {
  const mt = (a.mime_type || '').toLowerCase();
  if (mt.startsWith('image/')) return true;
  const name = (a.original_name || '').toLowerCase();
  return /\.(jpg|jpeg|png|gif|webp|bmp|ico|svg)$/.test(name);
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<(Ticket & { creator_name?: string; assignee_name?: string }) | null>(null);
  const [comments, setComments] = useState<(Comment & { user_name?: string })[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [imageBlobUrls, setImageBlobUrls] = useState<Record<number, string>>({});
  const imageBlobUrlsRef = useRef<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [commentContent, setCommentContent] = useState('');
  const [commentInternal, setCommentInternal] = useState(false);
  const [submitCommentLoading, setSubmitCommentLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [techs, setTechs] = useState<TechUser[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignModalTechId, setAssignModalTechId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as TicketPriority,
    category: 'other' as TicketCategory,
    assignee_id: null as number | null,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isStaff = user?.role === 'admin' || user?.role === 'technician';
  const isAdmin = user?.role === 'admin';

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get<{
        ticket: Ticket & { creator_name?: string; assignee_name?: string };
        comments: (Comment & { user_name?: string })[];
        attachments: Attachment[];
      }>(`/tickets/${id}`);
      setTicket(res.data.ticket);
      setComments(res.data.comments);
      setAttachments(res.data.attachments);
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { error?: string } } };
      message.error(err.response?.data?.error || '加载失败');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    if (ticket) {
      setEditForm({
        title: ticket.title,
        description: ticket.description,
        priority: ticket.priority,
        category: ticket.category,
        assignee_id: ticket.assignee_id,
      });
    }
  }, [ticket]);

  useEffect(() => {
    if (isStaff) {
      getTechs().then((r) => setTechs(r.users)).catch(() => setTechs([]));
    }
  }, [isStaff]);

  /** 为图片附件拉取 blob 并生成预览 URL（下载接口需鉴权，img 无法直接带 header） */
  useEffect(() => {
    if (!id || attachments.length === 0) {
      Object.values(imageBlobUrlsRef.current).forEach(URL.revokeObjectURL);
      imageBlobUrlsRef.current = {};
      setImageBlobUrls({});
      return;
    }
    const imageAttachments = attachments.filter(isImageAttachment);
    if (imageAttachments.length === 0) {
      Object.values(imageBlobUrlsRef.current).forEach(URL.revokeObjectURL);
      imageBlobUrlsRef.current = {};
      setImageBlobUrls({});
      return;
    }
    const revokePrevious = () => {
      Object.values(imageBlobUrlsRef.current).forEach(URL.revokeObjectURL);
      imageBlobUrlsRef.current = {};
    };
    revokePrevious();
    let cancelled = false;
    imageAttachments.forEach((a) => {
      api
        .get(`/tickets/${id}/download/${a.id}`, { responseType: 'blob' })
        .then((res) => {
          const url = URL.createObjectURL(res.data);
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          imageBlobUrlsRef.current[a.id] = url;
          setImageBlobUrls((prev) => ({ ...prev, [a.id]: url }));
        })
        .catch(() => {
          if (!cancelled) setImageBlobUrls((prev) => ({ ...prev, [a.id]: '' }));
        });
    });
    return () => {
      cancelled = true;
      revokePrevious();
      setImageBlobUrls({});
    };
  }, [id, attachments]);

  const submitComment = async () => {
    if (!commentContent.trim() || !id) return;
    setSubmitCommentLoading(true);
    try {
      const res = await api.post<{ comment: Comment & { user_name?: string } }>(`/tickets/${id}/comments`, {
        content: commentContent.trim(),
        is_internal: isStaff && commentInternal,
      });
      setComments((prev) => [...prev, { ...res.data.comment, user_name: res.data.comment.user_name }]);
      setCommentContent('');
      message.success('评论已添加');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || '提交失败');
    } finally {
      setSubmitCommentLoading(false);
    }
  };

  const updateStatus = async (status: TicketStatus) => {
    if (!id) return;
    setStatusUpdating(true);
    try {
      const res = await api.patch<{ ticket: Ticket }>(`/tickets/${id}/status`, { status });
      setTicket((prev) => (prev ? { ...prev, ...res.data.ticket } : null));
      message.success('状态已更新');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || '更新失败');
    } finally {
      setStatusUpdating(false);
    }
  };

  /** 状态变更前确认，防止误操作 */
  const handleStatusChange = (newStatus: TicketStatus) => {
    if (!ticket || newStatus === ticket.status) return;
    Modal.confirm({
      title: '确认更改状态',
      content: `确定要将工单状态从「${statusMap[ticket.status]}」改为「${statusMap[newStatus]}」吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: () => updateStatus(newStatus),
    });
  };

  const assign = async (assigneeId: number) => {
    if (!id) return;
    setAssigning(true);
    try {
      const res = await api.patch<{ ticket: Ticket & { assignee_name?: string } }>(`/tickets/${id}/assign`, {
        assignee_id: assigneeId,
      });
      setTicket((prev) =>
        prev ? { ...prev, assignee_id: assigneeId, assignee_name: res.data.ticket.assignee_name } : null
      );
      message.success('指派成功');
      setAssignModalOpen(false);
      setAssignModalTechId(null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      message.error(err.response?.data?.message || err.response?.data?.error || '指派失败，请稍后重试');
    } finally {
      setAssigning(false);
    }
  };

  /** 详情页指派确认：点击确定后执行指派 */
  const handleDetailAssignConfirm = () => {
    if (assignModalTechId == null) {
      message.warning('请选择要指派的技术员');
      return;
    }
    assign(assignModalTechId);
  };

  const saveEdit = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const res = await api.put<{ ticket: Ticket }>(`/tickets/${id}`, {
        title: editForm.title,
        description: editForm.description,
        priority: editForm.priority,
        category: editForm.category,
        assignee_id: editForm.assignee_id ?? undefined,
      });
      setTicket((prev) => (prev ? { ...prev, ...res.data.ticket } : null));
      setEditing(false);
      message.success('已保存');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const deleteTicket = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await api.delete(`/tickets/${id}`);
      message.success('工单已删除');
      navigate('/');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const uploadProps = {
    name: 'file',
    action: `${api.defaults.baseURL}/tickets/${id}/upload`,
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    showUploadList: false,
    onChange(info: { file?: { status?: string }; fileList?: unknown[] }) {
      if (info.file?.status === 'done') {
        message.success('上传成功');
        load();
      } else if (info.file?.status === 'error') {
        message.error('上传失败');
      }
    },
  };

  if (loading || !ticket) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <ClockCircleOutlined spin style={{ fontSize: 32, color: '#1890ff' }} />
        <div style={{ marginTop: 16 }}>加载中...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* 页面头部 */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <Space align="center" wrap>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            返回
          </Button>
          <span style={{ color: '#8c8c8c' }}>|</span>
          {editing ? (
            <Input
              value={editForm.title}
              onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="工单标题"
              style={{ width: 400 }}
            />
          ) : (
            <Text strong style={{ fontSize: 18 }}>
              #{ticket.id} {ticket.title}
            </Text>
          )}
        </Space>
        <Space wrap>
          {isStaff && !editing && (
            <Select
              value={ticket.status}
              onChange={handleStatusChange}
              loading={statusUpdating}
              style={{ width: 120 }}
              options={Object.entries(statusMap).map(([k, v]) => ({ value: k, label: v }))}
            />
          )}
          {isAdmin && !editing && (
            <Button type="primary" icon={<EditOutlined />} onClick={() => setEditing(true)}>
              编辑
            </Button>
          )}
          {editing && (
            <>
              <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={saveEdit}>
                保存
              </Button>
              <Button
                onClick={() => {
                  setEditing(false);
                  setEditForm({
                    title: ticket.title,
                    description: ticket.description,
                    priority: ticket.priority,
                    category: ticket.category,
                    assignee_id: ticket.assignee_id,
                  });
                }}
              >
                取消
              </Button>
            </>
          )}
          {isAdmin && (
            <Popconfirm title="确定删除该工单？此操作不可恢复。" onConfirm={deleteTicket} okText="确定" cancelText="取消">
              <Button danger icon={<DeleteOutlined />} loading={deleting}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      <Row gutter={[20, 20]}>
        {/* 左侧：描述 + 附件 */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <FileTextOutlined />
                <span>工单描述</span>
              </Space>
            }
            style={{ marginBottom: 16, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          >
            {editing ? (
              <TextArea
                rows={6}
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="详细描述"
              />
            ) : (
              <div style={{ whiteSpace: 'pre-wrap', color: '#262626' }}>{ticket.description}</div>
            )}
          </Card>

          <Card
            title={
              <Space>
                <UploadOutlined />
                <span>附件</span>
              </Space>
            }
            extra={
              <Upload {...uploadProps}>
                <Button size="small" icon={<UploadOutlined />}>
                  上传
                </Button>
              </Upload>
            }
            style={{ marginBottom: 16, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          >
            {attachments.length === 0 ? (
              <div style={{ color: '#8c8c8c', padding: '12px 0' }}>暂无附件</div>
            ) : (
              <Image.PreviewGroup>
                <List
                  grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4 }}
                  dataSource={attachments}
                  renderItem={(a: Attachment) => {
                    const ticketId = id;
                    const isImage = isImageAttachment(a);
                    const blobUrl = isImage ? imageBlobUrls[a.id] : null;

                    const handleDownload = () => {
                      if (!ticketId) return;
                      api.get(`/tickets/${ticketId}/download/${a.id}`, { responseType: 'blob' }).then((res) => {
                        const url = window.URL.createObjectURL(new Blob([res.data]));
                        const el = document.createElement('a');
                        el.href = url;
                        el.setAttribute('download', a.original_name);
                        el.click();
                        window.URL.revokeObjectURL(url);
                      });
                    };

                    return (
                      <List.Item>
                        {isImage ? (
                          <div style={{ textAlign: 'center' }}>
                            <Image
                              src={blobUrl || undefined}
                              alt={a.original_name}
                              width={100}
                              height={100}
                              style={{ objectFit: 'cover', borderRadius: 6 }}
                              placeholder={
                                <div
                                  style={{
                                    width: 100,
                                    height: 100,
                                    background: '#f0f0f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 6,
                                  }}
                                >
                                  <PictureOutlined style={{ fontSize: 28, color: '#bfbfbf' }} />
                                </div>
                              }
                              fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect fill='%23f0f0f0' width='100' height='100'/%3E%3Ctext x='50' y='55' fill='%23999' text-anchor='middle' font-size='12'%3E加载失败%3C/text%3E%3C/svg%3E"
                              preview={{ mask: <span style={{ fontSize: 12 }}>预览 / 下载</span> }}
                            />
                            <Tooltip title={a.original_name}>
                              <div style={{ marginTop: 6, fontSize: 12, color: '#262626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {a.original_name}
                              </div>
                            </Tooltip>
                            {a.size_bytes != null && (
                              <div style={{ fontSize: 11, color: '#8c8c8c' }}>{formatFileSize(a.size_bytes)}</div>
                            )}
                            <Button type="link" size="small" icon={<DownloadOutlined />} onClick={handleDownload} style={{ padding: '0 4px', fontSize: 12 }}>
                              下载
                            </Button>
                          </div>
                        ) : (
                          <Tooltip title={a.original_name}>
                            <div style={{ padding: '12px 0', textAlign: 'center' }}>
                              <FileTextOutlined style={{ fontSize: 36, color: '#8c8c8c' }} />
                              <div style={{ marginTop: 6, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {a.original_name}
                              </div>
                              {a.size_bytes != null && (
                                <div style={{ fontSize: 11, color: '#8c8c8c' }}>{formatFileSize(a.size_bytes)}</div>
                              )}
                              <Button type="link" size="small" icon={<DownloadOutlined />} onClick={handleDownload} style={{ padding: '0 4px', fontSize: 12 }}>
                                下载
                              </Button>
                            </div>
                          </Tooltip>
                        )}
                      </List.Item>
                    );
                  }}
                />
              </Image.PreviewGroup>
            )}
          </Card>
        </Col>

        {/* 右侧：元信息 */}
        <Col xs={24} lg={10}>
          <Card
            title="基本信息"
            style={{ marginBottom: 16, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          >
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="创建人">
                <Space>
                  <Avatar size="small" icon={<UserOutlined />} />
                  {ticket.creator_name || '-'}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="指派人">
                {editing && isAdmin ? (
                  <Select
                    placeholder="选择指派人"
                    allowClear
                    style={{ width: '100%' }}
                    value={editForm.assignee_id ?? undefined}
                    onChange={(v) => setEditForm((f) => ({ ...f, assignee_id: v ?? null }))}
                    options={techs.map((t) => ({ value: t.id, label: t.name }))}
                  />
                ) : (
                  <Space>
                    <Avatar size="small" icon={<UserOutlined />} />
                    {ticket.assignee_name || '未指派'}
                    {isAdmin && !editing && (
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: 0 }}
                        onClick={() => {
                          setAssignModalTechId(ticket.assignee_id ?? null);
                          setAssignModalOpen(true);
                          getTechs().then((r) => setTechs(r.users));
                        }}
                      >
                        重新指派
                      </Button>
                    )}
                  </Space>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="分类">
                {editing && isStaff ? (
                  <Select
                    style={{ width: '100%' }}
                    value={editForm.category}
                    onChange={(v) => setEditForm((f) => ({ ...f, category: v }))}
                    options={Object.entries(categoryMap).map(([k, v]) => ({ value: k, label: v }))}
                  />
                ) : (
                  categoryMap[ticket.category]
                )}
              </Descriptions.Item>
              <Descriptions.Item label="优先级">
                {editing && isStaff ? (
                  <Select
                    style={{ width: '100%' }}
                    value={editForm.priority}
                    onChange={(v) => setEditForm((f) => ({ ...f, priority: v }))}
                    options={Object.entries(priorityMap).map(([k, v]) => ({ value: k, label: v }))}
                  />
                ) : (
                  <Tag color={priorityColors[ticket.priority]}>{priorityMap[ticket.priority]}</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatDateTime(ticket.created_at)}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{formatDateTime(ticket.updated_at)}</Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 工单动态 */}
          <Card
            title={
              <Space>
                <ClockCircleOutlined />
                <span>工单动态</span>
              </Space>
            }
            style={{ marginBottom: 16, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          >
            <Timeline
              items={[
                {
                  color: 'green',
                  children: (
                    <div>
                      <div>工单创建</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {formatDateTime(ticket.created_at)} | {ticket.creator_name}
                      </Text>
                    </div>
                  ),
                },
              ].concat(
                comments.map((c) => ({
                  color: 'blue',
                  children: (
                    <div key={c.id}>
                      <div>
                        {c.user_name} 添加了评论
                        {c.is_internal && (
                          <Tag color="orange" style={{ marginLeft: 4 }}>
                            内部
                          </Tag>
                        )}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {formatDateTime(c.created_at)}
                      </Text>
                      <div style={{ marginTop: 4 }}>{c.content}</div>
                    </div>
                  ),
                }))
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* 指派技术员确认弹窗 */}
      <Modal
        title="指派技术员"
        open={assignModalOpen}
        onCancel={() => { setAssignModalOpen(false); setAssignModalTechId(null); }}
        onOk={handleDetailAssignConfirm}
        okText="确定"
        cancelText="取消"
        confirmLoading={assigning}
        destroyOnClose
      >
        {ticket && (
          <div style={{ padding: '8px 0' }}>
            <div style={{ marginBottom: 12, color: '#8c8c8c', fontSize: 12 }}>
              工单 #{ticket.id}：{ticket.title}
            </div>
            <Select
              placeholder="选择技术员"
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="label"
              value={assignModalTechId ?? undefined}
              onChange={(v) => setAssignModalTechId(v ?? null)}
              options={techs.map((t) => ({ value: t.id, label: `${t.name} (${t.email})` }))}
              notFoundContent="暂无技术员"
            />
          </div>
        )}
      </Modal>

      {/* 评论区域 */}
      <Card
        title={
          <Space>
            <CommentOutlined />
            <span>评论与沟通</span>
          </Space>
        }
        style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      >
        <List
          dataSource={[...comments].reverse()}
          renderItem={(c) => (
            <List.Item>
              <List.Item.Meta
                avatar={<Avatar icon={<UserOutlined />} />}
                title={
                  <Space>
                    {c.user_name}
                    {c.is_internal && <Tag color="orange">内部</Tag>}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {formatDateTime(c.created_at)}
                    </Text>
                  </Space>
                }
                description={<div style={{ whiteSpace: 'pre-wrap' }}>{c.content}</div>}
              />
            </List.Item>
          )}
        />
        <div style={{ marginTop: 16 }}>
          <TextArea
            rows={3}
            placeholder="输入评论内容..."
            value={commentContent}
            onChange={(e) => setCommentContent(e.target.value)}
          />
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            {isStaff && (
              <label style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={commentInternal} onChange={(e) => setCommentInternal(e.target.checked)} />{' '}
                内部备注（仅技术员/管理员可见）
              </label>
            )}
            <Button type="primary" loading={submitCommentLoading} onClick={submitComment} icon={<CommentOutlined />}>
              发送评论
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
