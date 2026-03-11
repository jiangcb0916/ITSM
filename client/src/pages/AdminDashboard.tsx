import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Tag, Button, message, Skeleton, Progress } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileTextOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  FieldTimeOutlined,
  CalendarOutlined,
  ArrowRightOutlined,
  CloseCircleOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { Pie, Line, Column } from '@ant-design/charts';
import {
  getTicketStats,
  listTickets,
  getDashboardTrend,
  getDashboardTechStats,
  getDashboardSla,
  getTechDashboardKpi,
  getTechStatusDistribution,
  getTechPriorityDistribution,
  getTechDashboardTrend,
  getTechDashboardSla,
  Ticket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from '../api';
import type { TicketStats, TechStatItem } from '../api';
import { useAuth } from '../context/AuthContext';

const statusMap: Record<TicketStatus, string> = {
  pending: '待处理',
  in_progress: '处理中',
  completed: '已完成',
  closed: '已关闭',
};
const priorityMap: Record<TicketPriority, string> = { low: '低', medium: '中', high: '高' };
const priorityColors: Record<TicketPriority, string> = { high: 'red', medium: 'orange', low: 'green' };
const statusColors: Record<TicketStatus, string> = {
  pending: 'default',
  in_progress: 'processing',
  completed: 'success',
  closed: 'default',
};
const categoryMap: Record<TicketCategory, string> = {
  network: '网络故障',
  software: '软件问题',
  hardware: '硬件问题',
  other: '其他',
};

const CARD_STYLE: React.CSSProperties = {
  borderRadius: 8,
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
};
const PAGE_PADDING = 24;
const ROW_GUTTER: [number, number] = [16, 16];
const CHART_HEIGHT_FIRST = 300;
const CHART_HEIGHT_TREND = 320;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isTechnician = user?.role === 'technician';

  const [stats, setStats] = useState<TicketStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [trendData, setTrendData] = useState<{ dates: string[]; created: number[]; resolved: number[] } | null>(null);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState<string | null>(null);
  const [techStats, setTechStats] = useState<TechStatItem[]>([]);
  const [techStatsLoading, setTechStatsLoading] = useState(true);
  const [techStatsError, setTechStatsError] = useState<string | null>(null);
  const [slaData, setSlaData] = useState<{ slaRate: number; metCount: number; totalCount: number; overdueCount: number } | null>(null);
  const [slaLoading, setSlaLoading] = useState(true);
  const [slaError, setSlaError] = useState<string | null>(null);

  // 技术人员个人仪表盘数据
  const [techKpi, setTechKpi] = useState<Awaited<ReturnType<typeof getTechDashboardKpi>> | null>(null);
  const [techKpiLoading, setTechKpiLoading] = useState(false);
  const [techStatusDist, setTechStatusDist] = useState<Awaited<ReturnType<typeof getTechStatusDistribution>> | null>(null);
  const [techStatusDistLoading, setTechStatusDistLoading] = useState(false);
  const [techPriorityDist, setTechPriorityDist] = useState<Awaited<ReturnType<typeof getTechPriorityDistribution>> | null>(null);
  const [techPriorityDistLoading, setTechPriorityDistLoading] = useState(false);
  const [techTrendData, setTechTrendData] = useState<{ dates: string[]; created: number[]; resolved: number[] } | null>(null);
  const [techTrendLoading, setTechTrendLoading] = useState(false);
  const [techTrendError, setTechTrendError] = useState<string | null>(null);
  const [techSlaData, setTechSlaData] = useState<{ slaRate: number; metCount: number; totalCount: number; overdueCount: number } | null>(null);
  const [techSlaLoading, setTechSlaLoading] = useState(false);
  const [techSlaError, setTechSlaError] = useState<string | null>(null);

  const loadStats = async () => {
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

  const loadRecentTickets = async () => {
    setRecentLoading(true);
    try {
      const { tickets } = await listTickets({ limit: 8, offset: 0 });
      setRecentTickets(tickets);
    } catch {
      message.error('加载最新工单失败');
    } finally {
      setRecentLoading(false);
    }
  };

  const loadTrend = async () => {
    setTrendLoading(true);
    setTrendError(null);
    try {
      const data = await getDashboardTrend(7);
      setTrendData(data);
    } catch {
      setTrendError('加载趋势数据失败');
      message.error('加载趋势数据失败');
    } finally {
      setTrendLoading(false);
    }
  };

  const loadTechStats = async () => {
    setTechStatsLoading(true);
    setTechStatsError(null);
    try {
      const { techs } = await getDashboardTechStats();
      setTechStats(techs);
    } catch {
      setTechStatsError('加载技术员负载失败');
      message.error('加载技术员负载失败');
    } finally {
      setTechStatsLoading(false);
    }
  };

  const loadSla = async () => {
    setSlaLoading(true);
    setSlaError(null);
    try {
      const data = await getDashboardSla();
      setSlaData(data);
    } catch {
      setSlaError('加载 SLA 数据失败');
      message.error('加载 SLA 数据失败');
    } finally {
      setSlaLoading(false);
    }
  };

  const loadTechDashboard = async () => {
    setTechKpiLoading(true);
    setTechStatusDistLoading(true);
    setTechPriorityDistLoading(true);
    setTechTrendLoading(true);
    setTechSlaLoading(true);
    setTechTrendError(null);
    setTechSlaError(null);
    try {
      const [kpi, statusDist, priorityDist] = await Promise.all([
        getTechDashboardKpi(),
        getTechStatusDistribution(),
        getTechPriorityDistribution(),
      ]);
      setTechKpi(kpi);
      setTechStatusDist(statusDist);
      setTechPriorityDist(priorityDist);
    } catch {
      message.error('加载个人仪表盘失败');
    } finally {
      setTechKpiLoading(false);
      setTechStatusDistLoading(false);
      setTechPriorityDistLoading(false);
    }
    getTechDashboardTrend(7)
      .then(setTechTrendData)
      .catch(() => {
        setTechTrendError('加载趋势数据失败');
        message.error('加载趋势数据失败');
      })
      .finally(() => setTechTrendLoading(false));
    getTechDashboardSla()
      .then(setTechSlaData)
      .catch(() => {
        setTechSlaError('加载 SLA 数据失败');
        message.error('加载 SLA 数据失败');
      })
      .finally(() => setTechSlaLoading(false));
  };

  useEffect(() => {
    loadRecentTickets();
    if (isTechnician) {
      loadTechDashboard();
    } else {
      loadStats();
      loadTrend();
      loadTechStats();
      loadSla();
    }
  }, [isTechnician]);

  const statusChartData =
    isTechnician && techStatusDist != null
      ? [
          { type: '待处理', value: techStatusDist.pending },
          { type: '处理中', value: techStatusDist.in_progress },
          { type: '已完成', value: techStatusDist.completed },
          { type: '已关闭', value: techStatusDist.closed },
        ].filter((d) => d.value > 0)
      : stats != null
        ? [
            { type: '待处理', value: stats.pending },
            { type: '处理中', value: stats.in_progress },
            { type: '已完成', value: stats.completed },
            { type: '已关闭', value: stats.closed },
          ].filter((d) => d.value > 0)
        : [];

  const pieConfig = {
    data: statusChartData,
    angleField: 'value',
    colorField: 'type',
    radius: 0.85,
    innerRadius: 0.6,
    color: ['#1890ff', '#52c41a', '#faad14', '#8c8c8c'],
  };

  const trendSource = isTechnician ? techTrendData : trendData;
  const lineData =
    trendSource != null
      ? trendSource.dates.flatMap((dateStr, i) => {
          const d = new Date(dateStr);
          const label = `${d.getMonth() + 1}/${d.getDate()}`;
          return [
            { date: label, type: '新建', value: trendSource.created[i] ?? 0 },
            { date: label, type: '完成', value: trendSource.resolved[i] ?? 0 },
          ];
        })
      : [];
  const lineConfig = {
    data: lineData,
    xField: 'date',
    yField: 'value',
    seriesField: 'type',
    smooth: true,
    color: ['#1890ff', '#52c41a'],
  };

  const techChartData = techStats.map((t) => ({
    techName: t.techName,
    count: t.assignedCount,
  }));
  const priorityChartData =
    techPriorityDist != null
      ? [
          { priority: '高', count: techPriorityDist.high },
          { priority: '中', count: techPriorityDist.medium },
          { priority: '低', count: techPriorityDist.low },
        ].filter((d) => d.count > 0)
      : [];
  const columnConfig = {
    data: isTechnician ? priorityChartData : techChartData,
    xField: isTechnician ? 'priority' : 'techName',
    yField: 'count',
    color: '#1890ff',
    label: { position: 'top' as const },
    xAxis: { label: { autoRotate: true } },
  };

  const kpiCards = [
    {
      key: 'total',
      title: '工单总数',
      value: isTechnician ? (techKpi?.total ?? 0) : (stats?.total ?? 0),
      icon: <FileTextOutlined style={{ fontSize: 28, color: '#1890ff' }} />,
    },
    {
      key: 'pending',
      title: '待处理',
      value: isTechnician ? (techKpi?.pending ?? 0) : (stats?.pending ?? 0),
      icon: <ClockCircleOutlined style={{ fontSize: 28, color: '#faad14' }} />,
    },
    {
      key: 'in_progress',
      title: '处理中',
      value: isTechnician ? (techKpi?.in_progress ?? 0) : (stats?.in_progress ?? 0),
      icon: <SyncOutlined spin style={{ fontSize: 28, color: '#1890ff' }} />,
    },
    {
      key: 'today',
      title: '今日新增',
      value: isTechnician ? (techKpi?.today_count ?? 0) : (stats?.today_count ?? 0),
      icon: <CalendarOutlined style={{ fontSize: 28, color: '#52c41a' }} />,
    },
    {
      key: 'avg',
      title: '平均响应(分钟)',
      value:
        isTechnician
          ? (techKpi?.avgResponseMinutes != null ? Math.round(techKpi.avgResponseMinutes) : '-')
          : (stats?.avgResponseMinutes != null ? Math.round(stats.avgResponseMinutes) : '-'),
      icon: <FieldTimeOutlined style={{ fontSize: 28, color: '#722ed1' }} />,
    },
  ];

  const topTech =
    !isTechnician && techStats.length > 0
      ? [...techStats].sort((a, b) => b.assignedCount - a.assignedCount)[0]
      : null;

  const recentColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 64,
      render: (id: number) => (
        <Link to={`/ticket/${id}`} style={{ fontWeight: 500, color: '#1890ff' }}>
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
      width: 80,
      render: (p: TicketPriority) => (
        <Tag color={priorityColors[p]}>{priorityMap[p]}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 88,
      render: (s: TicketStatus) => (
        <Tag color={statusColors[s]}>{statusMap[s]}</Tag>
      ),
    },
    {
      title: '指派人',
      dataIndex: 'assignee_name',
      width: 88,
      render: (v: string | undefined) => v || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 100,
      render: (v: string) => new Date(v).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
    },
  ];

  const cardTitleStyle = { fontSize: 16, fontWeight: 600 };
  const emptyChartStyle = (h: number) => ({
    height: h,
    display: 'flex' as const,
    alignItems: 'center',
    justifyContent: 'center',
    color: '#8c8c8c',
  });
  const errorChartStyle = (h: number) => ({ ...emptyChartStyle(h), color: '#ff4d4f' });

  return (
    <div
      style={{
        background: '#f5f7fa',
        minHeight: 'calc(100vh - 64px - 48px)',
        padding: PAGE_PADDING,
        boxSizing: 'border-box',
      }}
    >
      {/* 1. 页面标题 */}
      <h1 style={{ margin: '0 0 24px 0', fontSize: 20, fontWeight: 600, color: '#262626' }}>
        工单概览
      </h1>

      {/* 2. KPI 卡片行：6 张（管理员=负载最高，技术人员=我的完成率） */}
      <Row gutter={ROW_GUTTER} style={{ marginBottom: 24 }}>
        {kpiCards.map((item) => (
          <Col
            xs={24}
            sm={12}
            md={8}
            lg={6}
            xl={4}
            key={item.key}
            style={{ display: 'flex' }}
          >
            <Card
              style={{ ...CARD_STYLE, flex: 1, minHeight: 1 }}
              bodyStyle={{ padding: 16 }}
            >
              <Skeleton loading={isTechnician ? techKpiLoading : statsLoading} active paragraph={{ rows: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', minHeight: 72 }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 8 }}>{item.title}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#262626', lineHeight: 1.2 }}>
                      {item.value}
                    </div>
                  </div>
                  <div style={{ color: '#d9d9d9', flexShrink: 0 }}>{item.icon}</div>
                </div>
              </Skeleton>
            </Card>
          </Col>
        ))}
        {/* 第六张：技术人员=我的完成率，管理员=负载最高 */}
        <Col xs={24} sm={12} md={8} lg={6} xl={4} style={{ display: 'flex' }}>
          <Card style={{ ...CARD_STYLE, flex: 1, minHeight: 1 }} bodyStyle={{ padding: 16 }}>
            {isTechnician ? (
              <Skeleton loading={techKpiLoading} active paragraph={{ rows: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', minHeight: 72 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 8 }}>我的完成率</div>
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 700,
                        color: techKpi ? (techKpi.completionRate >= 80 ? '#52c41a' : '#faad14') : '#8c8c8c',
                        lineHeight: 1.2,
                      }}
                    >
                      {techKpi != null ? `${techKpi.completionRate}%` : '—'}
                    </div>
                  </div>
                  <div style={{ color: '#d9d9d9', flexShrink: 0 }}>
                    <TrophyOutlined style={{ fontSize: 28, color: '#52c41a' }} />
                  </div>
                </div>
              </Skeleton>
            ) : (
              <Skeleton loading={techStatsLoading} active paragraph={{ rows: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', minHeight: 72 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 8 }}>负载最高</div>
                    {topTech ? (
                      <>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#262626', lineHeight: 1.2 }}>
                          {topTech.assignedCount}
                        </div>
                        <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                          {topTech.techName} · 已完成 {topTech.resolvedCount} 单
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 28, fontWeight: 700, color: '#8c8c8c', lineHeight: 1.2 }}>—</div>
                    )}
                  </div>
                  <div style={{ color: '#d9d9d9', flexShrink: 0 }}>
                    <TrophyOutlined style={{ fontSize: 28, color: '#faad14' }} />
                  </div>
                </div>
              </Skeleton>
            )}
          </Card>
        </Col>
      </Row>

      {/* 3. 第一行图表：工单状态分布 + 技术员负载 + SLA 达标率（三列，宽屏占满） */}
      <Row gutter={ROW_GUTTER} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12} lg={8}>
          <Card
            title={<span style={cardTitleStyle}>工单状态分布</span>}
            style={CARD_STYLE}
            bodyStyle={{ padding: 16 }}
          >
            {(isTechnician ? techStatusDistLoading : statsLoading) ? (
              <div style={{ height: CHART_HEIGHT_FIRST, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Skeleton active paragraph={{ rows: 4 }} />
              </div>
            ) : statusChartData.length > 0 ? (
              <Pie {...pieConfig} height={CHART_HEIGHT_FIRST} />
            ) : (
              <div style={emptyChartStyle(CHART_HEIGHT_FIRST)}>暂无数据</div>
            )}
          </Card>
        </Col>
        <Col xs={24} md={12} lg={8}>
          <Card
            title={
              <span style={cardTitleStyle}>
                {isTechnician ? '工单优先级分布' : '技术员负载（指派工单数）'}
              </span>
            }
            style={CARD_STYLE}
            bodyStyle={{ padding: 16 }}
          >
            {(isTechnician ? techPriorityDistLoading : techStatsLoading) ? (
              <div style={{ height: CHART_HEIGHT_FIRST, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Skeleton active paragraph={{ rows: 4 }} />
              </div>
            ) : !isTechnician && techStatsError ? (
              <div style={errorChartStyle(CHART_HEIGHT_FIRST)}>{techStatsError}</div>
            ) : (isTechnician ? priorityChartData : techChartData).length > 0 ? (
              <Column {...columnConfig} height={CHART_HEIGHT_FIRST} />
            ) : (
              <div style={emptyChartStyle(CHART_HEIGHT_FIRST)}>
                {isTechnician ? '暂无数据' : '暂无技术员数据'}
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} md={24} lg={8}>
          <Card
            title={<span style={cardTitleStyle}>SLA 达标率</span>}
            style={CARD_STYLE}
            bodyStyle={{ padding: 16 }}
          >
            {(isTechnician ? techSlaLoading : slaLoading) ? (
              <div style={{ height: CHART_HEIGHT_FIRST, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Skeleton active paragraph={{ rows: 3 }} />
              </div>
            ) : (isTechnician ? techSlaError : slaError) ? (
              <div style={errorChartStyle(CHART_HEIGHT_FIRST)}>
                {isTechnician ? techSlaError : slaError}
              </div>
            ) : (() => {
              const sla = isTechnician ? techSlaData : slaData;
              if (sla == null) return <div style={emptyChartStyle(CHART_HEIGHT_FIRST)}>暂无数据</div>;
              return (
                <div style={{ height: CHART_HEIGHT_FIRST, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
                  <Progress
                    type="circle"
                    percent={sla.slaRate}
                    size={160}
                    strokeColor={sla.slaRate >= 95 ? '#52c41a' : sla.slaRate >= 80 ? '#faad14' : '#ff4d4f'}
                    format={() => (
                      <span style={{ fontSize: 22, fontWeight: 700 }}>{sla.slaRate}%</span>
                    )}
                  />
                  <div style={{ fontSize: 13, color: '#8c8c8c' }}>
                    达标 {sla.metCount}/{sla.totalCount} 单
                  </div>
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: sla.overdueCount > 0 ? '#fff2f0' : '#f5f5f5', borderRadius: 6 }}>
                      <span style={{ color: '#8c8c8c', fontSize: 13 }}>
                        <CloseCircleOutlined style={{ marginRight: 6, color: sla.overdueCount > 0 ? '#ff4d4f' : '#8c8c8c' }} />
                        超时工单
                      </span>
                      <span style={{ fontWeight: 600, fontSize: 16 }}>{sla.overdueCount}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </Card>
        </Col>
      </Row>

      {/* 4. 第二行图表：工单趋势（近7天）整行 */}
      <Row gutter={ROW_GUTTER} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card
            title={<span style={cardTitleStyle}>工单趋势（近7天）</span>}
            style={CARD_STYLE}
            bodyStyle={{ padding: 16 }}
          >
            {(isTechnician ? techTrendLoading : trendLoading) ? (
              <div style={{ height: CHART_HEIGHT_TREND, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Skeleton active paragraph={{ rows: 4 }} />
              </div>
            ) : (isTechnician ? techTrendError : trendError) ? (
              <div style={errorChartStyle(CHART_HEIGHT_TREND)}>
                {isTechnician ? techTrendError : trendError}
              </div>
            ) : lineData.length > 0 ? (
              <Line {...lineConfig} height={CHART_HEIGHT_TREND} />
            ) : (
              <div style={emptyChartStyle(CHART_HEIGHT_TREND)}>暂无数据</div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 5. 最新工单（整行） */}
      <Row gutter={ROW_GUTTER}>
        <Col span={24}>
          <Card
            title={<span style={cardTitleStyle}>最新工单</span>}
            style={CARD_STYLE}
            bodyStyle={{ padding: 0 }}
            extra={
              <Link to="/">
                <Button type="link" size="small" icon={<ArrowRightOutlined />}>
                  查看全部工单
                </Button>
              </Link>
            }
          >
            <Table
              rowKey="id"
              loading={recentLoading}
              columns={recentColumns}
              dataSource={recentTickets}
              pagination={false}
              size="small"
              scroll={{ x: 560 }}
              onRow={(r) => ({
                onClick: () => navigate(`/ticket/${r.id}`),
                style: { cursor: 'pointer' },
              })}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
