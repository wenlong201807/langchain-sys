import { useState } from 'react';
import { Card, Form, Input, InputNumber, Switch, Button, message, Divider, Typography } from 'antd';

const { Title } = Typography;

interface SystemConfigData {
  siteName: string;
  maxUploadSize: number;
  enableRegistration: boolean;
  maintenanceMode: boolean;
  apiRateLimit: number;
  sessionTimeout: number;
  smtpHost: string;
  smtpPort: number;
}

const initialConfig: SystemConfigData = {
  siteName: 'ThinkAgent',
  maxUploadSize: 10,
  enableRegistration: true,
  maintenanceMode: false,
  apiRateLimit: 100,
  sessionTimeout: 30,
  smtpHost: 'smtp.example.com',
  smtpPort: 587,
};

export default function SystemConfigPage() {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const onFinish = async (_values: SystemConfigData) => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    setLoading(false);
    message.success('Configuration saved');
  };

  return (
    <Card title="System Configuration">
      <Form
        form={form}
        layout="vertical"
        initialValues={initialConfig}
        onFinish={onFinish}
        style={{ maxWidth: 600 }}
      >
        <Title level={5}>General</Title>
        <Form.Item label="Site Name" name="siteName" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Max Upload Size (MB)" name="maxUploadSize">
          <InputNumber min={1} max={100} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Enable Registration" name="enableRegistration" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item label="Maintenance Mode" name="maintenanceMode" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Divider />
        <Title level={5}>API Settings</Title>
        <Form.Item label="Rate Limit (req/min)" name="apiRateLimit">
          <InputNumber min={10} max={1000} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Session Timeout (min)" name="sessionTimeout">
          <InputNumber min={5} max={120} style={{ width: '100%' }} />
        </Form.Item>

        <Divider />
        <Title level={5}>Email</Title>
        <Form.Item label="SMTP Host" name="smtpHost">
          <Input />
        </Form.Item>
        <Form.Item label="SMTP Port" name="smtpPort">
          <InputNumber min={1} max={65535} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Save Configuration
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}
