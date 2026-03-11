import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Select,
  Input,
  Space,
  Tag,
  message,
  Modal,
  Form,
  Checkbox,
  Popconfirm,
  Card,
  Row,
  Col,
  Upload,
  Tooltip,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  PlusOutlined,
  SearchOutlined,
  DeleteOutlined,
  FormOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  PictureOutlined,
  UserAddOutlined,
  FileTextOutlined,
  RiseOutlined,
  CalendarOutlined,
  FieldTimeOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import {
  api,
  getTechs,
  getTicketStats,
  getDashboardSla,
  getTicketTechStats,
  userDeleteTicket,
  createTicketWithAttachments,
  listTickets,
  assignTicket,
  deleteTicket,
  Ticket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  TechUser,
  TicketStats,
} from '../api';
import type { DashboardSlaResult, TicketTechStatsResult } from '../api';
import { useAuth } from '../context/AuthContext';

const MAX_SCREENSHOTS = 5;
const SCREENSHOT_MAX_SIZE_MB = 5;

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

const statusIcons: Record<TicketStatus, React.ReactNode> = {
  pending: <ClockCircleOutlined />,
  in_progress: <ExclamationCircleOutlined />,
  completed: <CheckCircleOutlined />,
  closed: <CheckCircleOutlined />,
};

const cardStyle = { borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' };
const cardBodyStyle = { padding: '16px' as const };

/** 统计卡片（5 个基础 KPI + 管理员 SLA 达标率 + 技术人员 我的完成率） */
function StatsCards({
  stats,
  loading,
  slaData,
  slaLoading,
  showSla,
  techStatsData,
  techStatsLoading,
  showTechStats,
}: {
  stats: TicketStats | null;
  loading: boolean;
  slaData: DashboardSlaResult | null;
  slaLoading: boolean;
  showSla: boolean;
  techStatsData: TicketTechStatsResult | null;
  techStatsLoading: boolean;
  showTechStats: boolean;
}) {
  if (!stats) return null;
  const cards = [
    { title: '总工单数', value: stats.total, icon: <FileTextOutlined />, color: '#1890ff' },
    { title: '待处理', value: stats.pending, icon: <ClockCircleOutlined />, color: '#faad14' },
    { title: '处理中', value: stats.in_progress, icon: <ExclamationCircleOutlined />, color: '#1890ff' },
    { title: '今日新增', value: stats.today_count, icon: <CalendarOutlined />, color: '#52c41a' },
    {
      title: '平均响应(分钟)',
      value: stats.avgResponseMinutes != null ? stats.avgResponseMinutes.toFixed(1) : '-',
      icon: <FieldTimeOutlined />,
      color: '#722ed1',
    },
  ];
  const slaRateColor = (rate: number) => (rate >= 95 ? '#52c41a' : rate >= 80 ? '#faad14' : '#ff4d4f');
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
      {cards.map((c) => (
        <Col xs={24} sm={12} md={8} lg={6} xl={4} key={c.title}>
          <Tooltip title={c.title}>
            <Card size="small" loading={loading} style={cardStyle} bodyStyle={cardBodyStyle}>
              <Space>
                <span style={{ fontSize: 28, color: c.color }}>{c.icon}</span>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#262626' }}>{c.value}</div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>{c.title}</div>
                </div>
              </Space>
            </Card>
          </Tooltip>
        </Col>
      ))}
      {showSla && (
        <Col xs={24} sm={12} md={8} lg={6} xl={4}>
          <Tooltip title="SLA 达标率：首响 24 小时内为达标">
            <Card size="small" loading={slaLoading} style={cardStyle} bodyStyle={cardBodyStyle}>
              <Space>
                <span
                  style={{
                    fontSize: 28,
                    color: slaData ? slaRateColor(slaData.slaRate) : '#8c8c8c',
                  }}
                >
                  <CheckCircleOutlined />
                </span>
                <div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 600,
                      color: slaData ? slaRateColor(slaData.slaRate) : '#8c8c8c',
                    }}
                  >
                    {slaData ? `${slaData.slaRate}%` : '—'}
                  </div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>SLA 达标率</div>
                </div>
              </Space>
            </Card>
          </Tooltip>
        </Col>
      )}
      {showTechStats && (
        <Col xs={24} sm={12} md={8} lg={6} xl={4}>
          <Tooltip title="指派给我的工单完成率">
            <Card size="small" loading={techStatsLoading} style={cardStyle} bodyStyle={cardBodyStyle}>
              <Space>
                <span
                  style={{
                    fontSize: 28,
                    color: techStatsData ? (techStatsData.completionRate >= 80 ? '#52c41a' : '#faad14') : '#8c8c8c',
                  }}
                >
                  <CheckCircleOutlined />
                </span>
                <div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 600,
                      color: techStatsData ? (techStatsData.completionRate >= 80 ? '#52c41a' : '#faad14') : '#8c8c8c',
                    }}
                  >
                    {techStatsData ? `${techStatsData.completionRate}%` : '—'}
                  </div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>我的完成率</div>
                </div>
              </Space>
            </Card>
          </Tooltip>
        </Col>
      )}
    </Row>
  );
}

export default function TicketList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [slaData, setSlaData] = useState<DashboardSlaResult | null>(null);
  const [slaLoading, setSlaLoading] = useState(false);
  const [techStatsData, setTechStatsData] = useState<TicketTechStatsResult | null>(null);
  const [techStatsLoading, setTechStatsLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [priority, setPriority] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createVisible, setCreateVisible] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form] = Form.useForm();
  const [autoAssign, setAutoAssign] = useState(true);
  const [techs, setTechs] = useState<TechUser[]>([]);
  const [userDeleteLoading, setUserDeleteLoading] = useState<number | null>(null);
  const [screenshotFileList, setScreenshotFileList] = useState<UploadFile[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [batchAssignTechId, setBatchAssignTechId] = useState<number | null>(null);
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false);
  /** 单条指派：当前操作的工单，非空时显示指派确认弹窗 */
  const [singleAssignTicket, setSingleAssignTicket] = useState<Ticket | null>(null);
  const [singleAssignTechId, setSingleAssignTechId] = useState<number | null>(null);
  const [singleAssignLoading, setSingleAssignLoading] = useState(false);

  const isStaff = user?.role === 'admin' || user?.role === 'technician';
  const isAdmin = user?.role === 'admin';
  const isTechnician = user?.role === 'technician';

  const loadStats = async () => {
    if (!isStaff) return;
    setStatsLoading(true);
    try {
      const data = await getTicketStats();
      setStats(data);
    } catch {
      message.error('加载统计失败');
    } finally {
      setStatsLoading(false);
    }
  };

  const loadSla = async () => {
    if (!isAdmin) return;
    setSlaLoading(true);
    try {
      const data = await getDashboardSla();
      setSlaData(data);
    } catch {
      setSlaData(null);
    } finally {
      setSlaLoading(false);
    }
  };

  const loadTechStats = async () => {
    if (!isTechnician) return;
    setTechStatsLoading(true);
    try {
      const data = await getTicketTechStats();
      setTechStatsData(data);
    } catch {
      setTechStatsData(null);
    } finally {
      setTechStatsLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await listTickets({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        ...(status && { status: status as TicketStatus }),
        ...(priority && { priority: priority as TicketPriority }),
        ...(category && { category: category as TicketCategory }),
        ...(search && { search }),
      });
      setTickets(data.tickets);
      setTotal(data.total);
    } catch {
      message.error('加载工单失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    if (isAdmin) loadSla();
    if (isTechnician) loadTechStats();
  }, [isStaff, isAdmin, isTechnician]);

  useEffect(() => {
    load();
  }, [page, pageSize, status, priority, category]);

  /** 新建工单弹窗打开时监听粘贴，将剪贴板图片加入问题截图 */
  useEffect(() => {
    if (!createVisible) return;
    const handlePaste = (ev: Event) => {
      const e = ev as ClipboardEvent;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const clipboardData = e.clipboardData;
      if (!clipboardData || !clipboardData.items) return;
      for (let i = 0; i < clipboardData.items.length; i++) {
        const item = clipboardData.items[i];
        if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
        const file = item.getAsFile();
        if (!file) continue;
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
          message.warning('仅支持 jpg、png、gif、webp 格式');
          e.preventDefault();
          return;
        }
        if (file.size > SCREENSHOT_MAX_SIZE_MB * 1024 * 1024) {
          message.warning(`单张图片不超过 ${SCREENSHOT_MAX_SIZE_MB}MB`);
          e.preventDefault();
          return;
        }
        setScreenshotFileList((prev) => {
          if (prev.length >= MAX_SCREENSHOTS) {
            message.warning(`最多只能上传 ${MAX_SCREENSHOTS} 张图片`);
            return prev;
          }
          const ext = (file.type.split('/')[1] || 'png').toLowerCase();
          const name = file.name && /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name)
            ? file.name
            : `screenshot-${Date.now()}.${ext}`;
          const url = URL.createObjectURL(file);
          const newFile = {
            uid: `paste-${Date.now()}-${i}`,
            name,
            status: 'done',
            url,
            originFileObj: file,
          } as UploadFile;
          return [...prev, newFile];
        });
        e.preventDefault();
        message.success('已添加截图');
        return;
      }
    };
    window.addEventListener('paste', handlePaste as EventListener);
    return () => window.removeEventListener('paste', handlePaste as EventListener);
  }, [createVisible]);

  const onSearch = () => {
    setPage(1);
    load();
  };

  /** 释放截图列表中的 blob URL，避免内存泄漏 */
  const revokeScreenshotBlobUrls = (list: UploadFile[]) => {
    list.forEach((f) => {
      const u = f.url ?? (f as UploadFile & { thumbUrl?: string }).thumbUrl;
      if (typeof u === 'string' && u.startsWith('blob:')) URL.revokeObjectURL(u);
    });
  };

  const openCreate = () => {
    setAutoAssign(true);
    setScreenshotFileList((prev) => {
      revokeScreenshotBlobUrls(prev);
      return [];
    });
    form.resetFields();
    getTechs().then((r) => setTechs(r.users)).catch(() => setTechs([]));
    setCreateVisible(true);
  };

  const onCreateFinish = async (v: {
    title: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
    assigned_to?: number;
  }) => {
    setCreateLoading(true);
    try {
      const hasScreenshots =
        screenshotFileList.length > 0 &&
        screenshotFileList.every((f) => f.originFileObj instanceof File);

      if (hasScreenshots) {
        const formData = new FormData();
        formData.append('title', v.title);
        formData.append('description', v.description);
        formData.append('category', v.category);
        formData.append('priority', v.priority);
        if (!autoAssign && v.assigned_to) {
          formData.append('assigned_to', String(v.assigned_to));
        }
        screenshotFileList.forEach((f) => {
          if (f.originFileObj) formData.append('screenshots', f.originFileObj);
        });
        await createTicketWithAttachments(formData);
      } else {
        const body: Record<string, unknown> = {
          title: v.title,
          description: v.description,
          category: v.category,
          priority: v.priority,
        };
        if (!autoAssign && v.assigned_to) body.assigned_to = v.assigned_to;
        await api.post('/tickets', body);
      }
      message.success('工单已创建');
      setCreateVisible(false);
      form.resetFields();
      setScreenshotFileList((prev) => {
        revokeScreenshotBlobUrls(prev);
        return [];
      });
      await load();
      await loadStats();
      if (isAdmin) await loadSla();
      if (isTechnician) await loadTechStats();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || '创建失败');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleUserDelete = async (r: Ticket) => {
    setUserDeleteLoading(r.id);
    try {
      await userDeleteTicket(r.id);
      message.success('已从您的列表中移除');
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || '操作失败');
    } finally {
      setUserDeleteLoading(null);
    }
  };

  const handleBatchAssign = async () => {
    if (batchAssignTechId == null || selectedRowKeys.length === 0) return;
    setAssigning(true);
    try {
      await Promise.all(
        selectedRowKeys.map((id) => assignTicket(Number(id), batchAssignTechId))
      );
      message.success(`已批量指派 ${selectedRowKeys.length} 个工单`);
      setAssignModalOpen(false);
      setBatchAssignTechId(null);
      setSelectedRowKeys([]);
      load();
      loadStats();
      if (isAdmin) loadSla();
      if (isTechnician) loadTechStats();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || '批量指派失败');
    } finally {
      setAssigning(false);
    }
  };

  /** 单条指派确认 */
  const handleSingleAssignConfirm = async () => {
    if (!singleAssignTicket || singleAssignTechId == null) {
      message.warning('请选择要指派的技术员');
      return;
    }
    setSingleAssignLoading(true);
    try {
      await assignTicket(singleAssignTicket.id, singleAssignTechId);
      message.success('指派成功');
      setSingleAssignTicket(null);
      setSingleAssignTechId(null);
      load();
      loadStats();
      if (isAdmin) loadSla();
      if (isTechnician) loadTechStats();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      message.error(err.response?.data?.message || err.response?.data?.error || '指派失败，请稍后重试');
    } finally {
      setSingleAssignLoading(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) return;
    setBatchDeleteLoading(true);
    try {
      await Promise.all(selectedRowKeys.map((id) => deleteTicket(Number(id))));
      message.success(`已删除 ${selectedRowKeys.length} 个工单`);
      setSelectedRowKeys([]);
      load();
      loadStats();
      if (isAdmin) loadSla();
      if (isTechnician) loadTechStats();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || '批量删除失败');
    } finally {
      setBatchDeleteLoading(false);
    }
  };

  const screenshotUploadProps = {
    accept: '.jpg,.jpeg,.png,.gif,.webp',
    listType: 'picture-card' as const,
    fileList: screenshotFileList,
    maxCount: MAX_SCREENSHOTS,
    beforeUpload: (file: File) => {
      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
      if (!isImage) {
        message.error('仅支持 jpg、png、gif、webp 格式');
        return Upload.LIST_IGNORE;
      }
      if (file.size > SCREENSHOT_MAX_SIZE_MB * 1024 * 1024) {
        message.error(`单张图片不超过 ${SCREENSHOT_MAX_SIZE_MB}MB`);
        return Upload.LIST_IGNORE;
      }
      const url = URL.createObjectURL(file);
      setScreenshotFileList((prev) => [
        ...prev,
        { uid: `${Date.now()}-${file.name}`, name: file.name, status: 'done', url, originFileObj: file } as UploadFile,
      ]);
      return false;
    },
    onRemove: (file: UploadFile) => {
      if (typeof file.url === 'string' && file.url.startsWith('blob:')) URL.revokeObjectURL(file.url);
      setScreenshotFileList((prev) => prev.filter((item) => item.uid !== file.uid));
    },
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 72,
      sorter: (a: Ticket, b: Ticket) => a.id - b.id,
      render: (id: number) => (
        <Link to={`/ticket/${id}`} style={{ color: '#1890ff', fontWeight: 500 }}>
          #{id}
        </Link>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
      render: (t: string, r: Ticket) => (
        <Link to={`/ticket/${r.id}`} style={{ color: '#262626' }}>
          {t}
        </Link>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 88,
      render: (p: TicketPriority) => (
        <Tag color={priorityColors[p]} icon={<RiseOutlined />}>
          {priorityMap[p]}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: TicketStatus) => (
        <Tag color={statusColors[s]} icon={statusIcons[s]}>
          {statusMap[s]}
        </Tag>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 100,
      render: (c: TicketCategory) => categoryMap[c],
    },
    { title: '创建人', dataIndex: 'creator_name', width: 90, ellipsis: true },
    {
      title: '指派人',
      dataIndex: 'assignee_name',
      width: 90,
      ellipsis: true,
      render: (v: string | undefined) => v || '未指派',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 160,
      sorter: (a: Ticket, b: Ticket) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      render: (v: string) => new Date(v).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
    },
    {
      title: '操作',
      key: 'action',
      width: isAdmin ? 160 : 100,
      fixed: 'right' as const,
      render: (_: unknown, r: Ticket) => (
        <Space size="small" wrap>
          {isAdmin && (
            <Tooltip title="指派技术员">
              <Button
                type="link"
                size="small"
                icon={<UserAddOutlined />}
                onClick={() => {
                  setSingleAssignTicket(r);
                  setSingleAssignTechId(r.assignee_id ?? null);
                  getTechs().then((res) => setTechs(res.users));
                }}
              >
                指派
              </Button>
            </Tooltip>
          )}
          {isAdmin && (
            <Popconfirm
              title="确定永久删除该工单？"
              description="删除后不可恢复。"
              onConfirm={async () => {
                try {
                  await deleteTicket(r.id);
                  message.success('已删除');
                  load();
                  loadStats();
                  if (isAdmin) loadSla();
                  if (isTechnician) loadTechStats();
                } catch (e: unknown) {
                  const err = e as { response?: { data?: { error?: string } } };
                  message.error(err.response?.data?.error || '删除失败');
                }
              }}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
          {user?.role === 'user' && r.creator_id === user?.id && (
            <Popconfirm
              title="确定要从您的列表中删除该工单吗？"
              description="此操作仅对您隐藏，技术员和管理员仍可看到并处理该工单。"
              onConfirm={() => handleUserDelete(r)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={userDeleteLoading === r.id}
              >
                移除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const rowSelection = isAdmin
    ? {
        selectedRowKeys,
        onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
      }
    : undefined;

  return (
    <div style={{ padding: '0 4px' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#262626' }}>工单管理</h1>
      </div>

      {/* 统计卡片（仅管理员/技术员；管理员多展示 SLA 达标率） */}
      {isStaff && (
        <StatsCards
          stats={stats}
          loading={statsLoading}
          slaData={slaData}
          slaLoading={slaLoading}
          showSla={isAdmin}
          techStatsData={techStatsData}
          techStatsLoading={techStatsLoading}
          showTechStats={isTechnician}
        />
      )}

      {/* 筛选栏 */}
      <Card size="small" style={{ marginBottom: 16, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Space wrap size="middle" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap size="middle">
            <Select
              placeholder="状态"
              allowClear
              style={{ width: 112 }}
              value={status || undefined}
              onChange={setStatus}
              options={Object.entries(statusMap).map(([k, v]) => ({ value: k, label: v }))}
            />
            <Select
              placeholder="优先级"
              allowClear
              style={{ width: 96 }}
              value={priority || undefined}
              onChange={setPriority}
              options={Object.entries(priorityMap).map(([k, v]) => ({ value: k, label: v }))}
            />
            <Select
              placeholder="分类"
              allowClear
              style={{ width: 112 }}
              value={category || undefined}
              onChange={setCategory}
              options={Object.entries(categoryMap).map(([k, v]) => ({ value: k, label: v }))}
            />
            <Input
              placeholder="搜索标题/描述"
              style={{ width: 180 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={onSearch}
              allowClear
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={onSearch}>
              搜索
            </Button>
          </Space>
          <Space>
            {isAdmin && selectedRowKeys.length > 0 && (
              <>
                <Button
                  icon={<UserAddOutlined />}
                  onClick={() => setAssignModalOpen(true)}
                >
                  批量指派 ({selectedRowKeys.length})
                </Button>
                <Popconfirm
                  title="确定永久删除所选工单？"
                  description="删除后不可恢复。"
                  onConfirm={handleBatchDelete}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button danger icon={<DeleteOutlined />} loading={batchDeleteLoading}>
                    批量删除
                  </Button>
                </Popconfirm>
              </>
            )}
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新建工单
            </Button>
          </Space>
        </Space>
      </Card>

      {/* 单条指派确认弹窗 */}
      <Modal
        title="指派技术员"
        open={singleAssignTicket != null}
        onCancel={() => { setSingleAssignTicket(null); setSingleAssignTechId(null); }}
        onOk={handleSingleAssignConfirm}
        okText="确定"
        cancelText="取消"
        confirmLoading={singleAssignLoading}
        destroyOnClose
      >
        {singleAssignTicket && (
          <div style={{ padding: '8px 0' }}>
            <div style={{ marginBottom: 12, color: '#8c8c8c', fontSize: 12 }}>
              工单 #{singleAssignTicket.id}：{singleAssignTicket.title}
            </div>
            <Select
              placeholder="选择技术员"
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="label"
              value={singleAssignTechId ?? undefined}
              onChange={(v) => setSingleAssignTechId(v ?? null)}
              options={techs.map((t) => ({ value: t.id, label: `${t.name} (${t.email})` }))}
              notFoundContent="暂无技术员"
            />
          </div>
        )}
      </Modal>

      {/* 批量指派弹窗 */}
      <Modal
        title="批量指派"
        open={assignModalOpen}
        onCancel={() => { setAssignModalOpen(false); setBatchAssignTechId(null); }}
        onOk={handleBatchAssign}
        okText="确定"
        cancelText="取消"
        confirmLoading={assigning}
        destroyOnClose
      >
        <div style={{ padding: '8px 0' }}>
          <Select
            placeholder="选择技术员"
            style={{ width: '100%' }}
            showSearch
            optionFilterProp="label"
            value={batchAssignTechId ?? undefined}
            onChange={(v) => setBatchAssignTechId(v ?? null)}
            onDropdownVisibleChange={(open) => open && getTechs().then((r) => setTechs(r.users))}
            options={techs.map((t) => ({ value: t.id, label: `${t.name} (${t.email})` }))}
            notFoundContent="暂无技术员"
          />
        </div>
      </Modal>

      {/* 新建工单弹窗 */}
      <Modal
        title={null}
        open={createVisible}
        onCancel={() => {
          setCreateVisible(false);
          setScreenshotFileList([]);
        }}
        footer={null}
        destroyOnClose
        width={560}
      >
        <Card
          title={
            <Space>
              <FormOutlined style={{ color: '#1890ff' }} />
              <span>新建工单</span>
            </Space>
          }
          style={{ borderRadius: 8 }}
          bodyStyle={{ paddingTop: 8 }}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={onCreateFinish}
            initialValues={{ autoAssign: true }}
          >
            <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
              <Input placeholder="简要描述问题" />
            </Form.Item>
            <Form.Item
              name="description"
              label="描述"
              rules={[{ required: true, message: '请输入描述' }]}
            >
              <Input.TextArea rows={4} placeholder="详细描述问题现象与复现步骤" />
            </Form.Item>
            <Form.Item label="问题截图" extra={`最多 ${MAX_SCREENSHOTS} 张，单张不超过 ${SCREENSHOT_MAX_SIZE_MB}MB，支持 jpg/png/gif/webp；支持 Ctrl+V（Mac 上 Cmd+V）粘贴截图`}>
              <Upload {...screenshotUploadProps}>
                {screenshotFileList.length >= MAX_SCREENSHOTS ? null : (
                  <div>
                    <PictureOutlined style={{ fontSize: 24 }} />
                    <div style={{ marginTop: 8 }}>点击或拖拽上传</div>
                  </div>
                )}
              </Upload>
            </Form.Item>
            <Form.Item name="category" label="分类" initialValue="other">
              <Select options={Object.entries(categoryMap).map(([k, v]) => ({ value: k, label: v }))} />
            </Form.Item>
            <Form.Item name="priority" label="优先级" initialValue="medium">
              <Select options={Object.entries(priorityMap).map(([k, v]) => ({ value: k, label: v }))} />
            </Form.Item>
            <Form.Item>
              <Checkbox
                checked={autoAssign}
                onChange={(e) => setAutoAssign(e.target.checked)}
              >
                自动分配（由系统指派当前工单最少的技术员）
              </Checkbox>
            </Form.Item>
            {!autoAssign && (
              <Form.Item name="assigned_to" label="指派技术员">
                <Select
                  placeholder="选择技术员"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={techs.map((t) => ({ value: t.id, label: `${t.name} (${t.email})` }))}
                />
              </Form.Item>
            )}
            <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
              <Space>
                <Button type="primary" htmlType="submit" loading={createLoading}>
                  提交
                </Button>
                <Button
                  onClick={() => {
                    setCreateVisible(false);
                    setScreenshotFileList([]);
                  }}
                >
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </Modal>

      {/* 工单表格 */}
      <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={tickets}
          rowSelection={rowSelection}
          rowClassName={() => 'ticket-list-row'}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => {
              setPage(p);
              if (typeof ps === 'number') setPageSize(ps);
            },
          }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  );
}
