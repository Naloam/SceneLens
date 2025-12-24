/**
 * PredictiveTrigger 用户反馈学习功能演示测试
 */

import { demonstrateUserFeedbackLearning, demonstrateRealWorldScenario } from '../predictive-trigger-feedback-demo';

describe('PredictiveTrigger User Feedback Learning Demo', () => {
  it('should demonstrate user feedback learning functionality', async () => {
    // 捕获控制台输出以验证演示正常运行
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    await demonstrateUserFeedbackLearning();
    
    // 验证演示输出了预期的内容
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('PredictiveTrigger 用户反馈学习功能演示')
    );
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('需求 10.3')
    );
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('需求 10.6')
    );
    
    consoleSpy.mockRestore();
  });

  it('should demonstrate real world scenario', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    await demonstrateRealWorldScenario();
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('实际使用场景演示')
    );
    
    consoleSpy.mockRestore();
  });
});