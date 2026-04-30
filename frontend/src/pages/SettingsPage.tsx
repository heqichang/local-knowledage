import { type FC } from 'react'

const SettingsPage: FC = () => {
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-gray-800">系统设置</h2>
      <p className="mt-2 text-gray-500">配置模型、检索参数等</p>
    </div>
  )
}

export default SettingsPage
